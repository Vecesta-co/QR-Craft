# Architecture

QR Craft is a static Next.js application with one deliberately small runtime surface:

- a React UI shell and React Three Fiber viewer in the browser;
- a Web Worker for deterministic world generation and verification;
- a shared dense voxel world reconstructed on the main thread;
- no server-side generation, database, account system, AI API or runtime network dependency.

This document describes the actual data paths and conventions. Subsystem details live in the linked documents.

---

## 1. Runtime topology

```text
┌──────────────────────────────── browser main thread ────────────────────────────────┐
│                                                                                      │
│  EncodePanel                                                                         │
│    payload / seed / size / site / style / quality / complexity                       │
│         │                                                                            │
│         ├── createQrMatrix()  (qrcode, EC M, quiet zone 4)                           │
│         │                                                                            │
│         ▼                                                                            │
│  generation-service.ts ── postMessage ──────────────► generate.worker.ts              │
│         ▲                                                │                           │
│         │                                                │ generateWorld()            │
│         │                                                │  ├ siteFor(id)             │
│         │                                                │  ├ terrain + site features │
│         │                                                │  ├ style grammar + city    │
│         │                                                │  ├ quality passes          │
│         │                                                │  ├ projection check       │
│         │                                                │  ├ software top decode    │
│         │                                                │  ├ stats + scene score    │
│         │                                                │  └ compileBuildPlan()     │
│         │                                                │                           │
│         │                                                │ buildRenderPayload()       │
│         │                                                │ baseWorld.snapshot()       │
│         │◄──────────── done + transferable buffers ──────┘                           │
│         │                                                                            │
│         ▼                                                                            │
│  VoxelWorld.fromOwnedSnapshot(baseSnapshot)                                          │
│         │                                                                            │
│         ▼                                                                            │
│  ConstructionEngine(world, plan) ── rAF ── applies placements to that same world     │
│         │                                                                            │
│         ├── WorldMesh reads engine.applied and the order attribute in the shader      │
│         ├── ExploreController reads the same live world                               │
│         ├── TopViewCertifier renders the scene and decodes the capture               │
│         └── ExportPanel reads the completed world                                     │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

The only work that leaves the main thread is the initial generation. Construction, rendering, certification and exports all operate on the main-thread `VoxelWorld`.

### Why the worker gets a QR matrix, not a payload

The worker receives the already-encoded `QRMatrix` from the main thread. This keeps the `qrcode` package out of the worker bundle and makes the exact matrix that is displayed, projected and certified the same object used for generation. The worker never re-encodes the payload.

### Transferred data

`GeneratedWorldTransfer` contains:

| Field | Purpose |
| --- | --- |
| `qr` | The canonical matrix, including its quiet zone. |
| `layout` | Site dimensions, cell size, city/plateau/moat rectangles, heights, spawn. |
| `baseSnapshot` | Bare terrain before city construction. Transferred without copying. |
| `renderPalette` | Palette of the completed world, including full block-state strings. |
| `render` | Instanced positions, palette indices and construction orders for exposed blocks. |
| `plan` | Dependency-ordered construction tasks and their placements. |
| `stats` / `brief` / `city` | Display and scoring metadata measured from the completed world. |
| `projection` | Column-by-column projection report. |
| `softwareDecode` | Result of decoding a real software-rendered top view. |
| `requestedSize` / `generationMs` | Upgrade reporting and measured generation time. |

`finalWorld` is **not** transferred. The main thread rebuilds it by starting from `baseSnapshot` and letting the builder apply every planned placement. This is what makes "what you watched being built" identical to "what you verify, explore and export".

The render payload also does not keep a second copy of the city. Static terrain is taken from the bare world; planned blocks are added from the completed world with their construction order. The shader reveals a planned block only when `aOrder <= uApplied`.

---

## 2. Coordinates and QR conventions

These conventions are load-bearing. They are enforced in `src/lib/qr/matrix.ts`, `src/lib/world/site.ts` and `src/lib/world/VoxelWorld.ts`.

### QR matrix

- `data` is **row-major**: `index = row * size + col`.
- `1` means a dark module, `0` means a light module.
- Row 0 is the **top** row of the printed symbol.
- The quiet zone is already added on all four sides. `size` includes it; `moduleCount` excludes it.
- At the default payload, the matrix is version 3, 29 × 29 modules, with a 4-module quiet zone, so `size = 37`.

### World

- **X increases east.**
- **Y increases up.**
- **Z increases south.**
- The QR top row maps to the **lowest Z**. Therefore, looking down with north at the top, row 0 is north.
- `x = cityX + col * cellSize`, `z = cityZ + row * cellSize`.
- The city includes the quiet zone; the whole matrix is placed on the plateau.
- Voxel storage is dense YZX: `index = (y * sizeZ + z) * sizeX + x`. This is also Sponge schematic data order.
- Palette entry 0 is always `minecraft:air`.

`worldToModule()` uses the inverse mapping. Any projected column inside `cityRect` is assigned to exactly one module; no gaps and no overlapping cells.

### Site geometry

`createSiteLayout()` adds, from inside out:

| Band | Width | Purpose |
| --- | --- | --- |
| City | `qr.size * cellSize` | QR modules and all town architecture |
| Esplanade | 6 blocks | Light perimeter, approach, quiet-zone breathing room |
| Moat | 6 blocks | Real water ditch, 2 blocks below the plateau |
| Landscape | remaining margin | Site features, trees, rocks, landmarks, fields/hamlet where they fit |

Height references: water surface Y = 16, plateau top Y = 19, city ground Y = 20, bridge deck Y = 20. World height is 84.

`chooseWorldSize()` enforces at least 3 blocks per module and at most 7, and upgrades the requested size when the payload cannot otherwise fit. Each site definition also declares a `minimumSize`; a site that needs room for a dominant landmark never silently shrinks it.

Legacy sites keep the V1 sizing rule: the 192² Kingdom with a 37-module matrix uses 4 blocks per module and a 148² city. V2 sites also reserve a **12-block landscape band** outside the moat for their outer landmarks. With the same 37-module payload at 192², the band forces 3 blocks per module and a 111² city (or a larger site when the payload needs one). `createSiteLayout()` receives that band from `siteLandscapeBand()`; the size and cell size shown by the encoder preview and the generated layout use the same call. If a very large payload only fits 320² without the band, the payload wins and the brief omits any outer feature that no longer has room.

The 24 site ids live in `src/lib/sites/`. The first four — `hamlet`, `kingdom`, `grand-kingdom`, `monumental` — keep the original valley generator and exact V1 layout. The 20 new sites use data-driven terrain profiles, vegetation, water rules, outer features and landmark labels.

---

## 3. Generation pipeline

`generateWorld()` in `src/lib/world/generate.ts` executes in this order:

1. **Resolve the site and layout** — `siteFor(id)`, validate size, apply the site minimum, compute rectangles, heights and spawn.
2. **Generate terrain** — heightmap, plateau, open moat, bridge, approach road, optional fields/hamlet, site-specific relief, fluid, surface, vegetation and decorations.
3. **Build outer site features** — data-driven landmarks outside the city, such as alpine gates, harbours, giant trees, volcanoes, crystal caverns, ruins, terraces and sky islands.
4. **Clone the terrain** — `baseWorld` is the construction start state; `finalWorld` receives the city.
5. **Compose the city** — paint the QR ground, reserve quiet zone and finder footprints, place landmarks, road grid, market, avenue, houses and approach. Style grammar decides roof, wall, window, door and ornament geometry; the quality tier decides how many detail passes run.
6. **Check projection** — compare every city column's top block against its module.
7. **Decode the software top view** — render the actual top projection and decode it with ZXing.
8. **Measure stats and score** — counts, peak height, coverage, deterministic scene heuristics.
9. **Compile the build plan** — group placements into dependency-ordered tasks.
10. **Build the render payload** — exposed terrain plus planned blocks with construction order.

Failures in steps 1–7 are recorded honestly. A projection conflict or a failed software decode makes the initial status `Certification failed` and shows the reason. The world may still be displayed for inspection, but it is never labelled `QR VERIFIED`.

### Site registry

`src/lib/sites/registry.ts` combines the legacy definitions with the west/east catalogs. Every `WorldSiteDefinition` declares:

- category, description and recommended sizes;
- terrain profile, relief, fluid, surface blocks, vegetation and decorations;
- primary/secondary outer landmarks and city-specific feature kinds;
- city density, tower bias, road spacing, landmark scale and detailing;
- excellent and good style compatibility;
- a legacy flag that selects the preserved V1 path.

The registry asserts completeness at import time. There are no per-site generator branches; the site data drives the shared builders.

### Style registry

`src/lib/blocks/styles.ts` owns the canonical 53-id order. Definitions live in five category files:

- `styles-medieval.ts`
- `styles-classical.ts`
- `styles-asian.ts`
- `styles-regional.ts`
- `styles-fantasy.ts`

Each `StyleDefinition` supplies dark/light material sets, a structural palette, roof/wall/window/door/detail/lighting grammar and proportions. The first three ids (`gothic`, `royal`, `rustic`) keep their V1 identity. The style is a data contract, not a switch statement in the city builder.

### Quality tiers

`standard`, `detailed` and `showcase` are real construction passes in `src/lib/world/architecture.ts` and the city/landmark detail passes:

- **Standard** — core architecture, doors, windows, roofs and essential lighting.
- **Detailed** — adds façade framing, roof variation, entrance paths, planters, balconies and more lighting.
- **Showcase** — adds fine trims, extra roof systems, courtyard decoration, richer lighting and landmark detail.

All tiers preserve the QR top projection. Quality changes the number and kind of placements, never the module class of a city column.

More detail: [world-generation.md](world-generation.md).

---

## 4. Live construction

`ConstructionEngine` is a small state machine with four modes: `travel`, `build`, `settle`, `complete`.

- It walks the compiled task array in order.
- For each task, it moves the builder pose to the task anchor, applies placements one at a time to the live `VoxelWorld`, waits a short settle period, then advances.
- `engine.applied` is the global placement count.
- `WorldMesh` updates `revealUniform` from `engine.applied` every frame.
- Every planned block instance carries its placement order. The vertex shader collapses not-yet-applied instances to a zero-scale point.
- On completion, the store requests live certification automatically.

The engine does not animate a separate decorative copy. Pause/resume/cancel all act on this executor. Every site, style and quality tier produces the same kind of real plan; there is no pre-baked tier animation. See [builder-system.md](builder-system.md).

---

## 5. Rendering

- `WorldMesh` groups exposed blocks by palette index and creates one `InstancedMesh` per material.
- Geometry is shared within a group; instance matrices are static.
- Palette entries may be full block-state strings. Rendering resolves them through `baseBlockId()`, so stairs, slabs, doors and walls use the correct base texture.
- Textures are original procedural 16 × 16 textures, generated from the pure `buildTexturePixels()` builder and cached per block id.
- Transparent blocks use a separate transparent material with depth-write disabled and double-sided faces.
- `SceneAtmosphere` provides a gradient sky, fog, hemisphere/ambient/directional lights and a visual sea plane.
- The scene uses an orthographic camera in Top-down mode and a perspective camera with orbit controls in Showcase mode.
- `BuilderCharacter` is a simple articulated figure whose pose follows the engine; it is hidden in Top-view capture if marked `qrCaptureHide`.

No runtime assets are downloaded. See [asset-pipeline.md](asset-pipeline.md).

---

## 6. Certification path

`TopViewCertifier` lives inside the R3F scene so it can render the real scene graph:

1. Hide objects marked `qrCaptureHide`, remove scene fog/background, disable tone mapping.
2. Set the reveal uniform to the full plan so nothing is hidden by the construction animation.
3. Render from a `THREE.OrthographicCamera` at Y = 330 into a 1536 × 1536 `WebGLRenderTarget`.
4. Read the pixels back and flip them into top-row-first order.
5. Determine the exact city + esplanade framing.
6. Decode the 512, 448 and 384 scan-scale variants and the blurred 512 variant with ZXing.
7. Require exact string equality with the requested payload.
8. Restore all scene state and publish the status and capture preview.

The 1536² raw capture alone does not reliably decode for this module/block geometry. The certification success path therefore uses resampled images derived from that same real capture. This is documented openly in [qr-certification.md](qr-certification.md).

The earlier software check in generation (`certifyTopView`) rasterizes the actual voxel top projection at a bounded `maxEdge` (600 by default) and decodes it with ZXing. It is a real optical decode, not a matrix comparison.

---

## 7. State and invalidation

The Zustand store (`src/state/useQrCraft.ts`) holds:

- the draft configuration (`payload`, `seed`, `size`, `site`, `style`, `quality`, `complexity`);
- generation stage/error;
- the generated result, live world, engine and builder state;
- view mode and camera preset;
- certification state and certification request id;
- `dirty`: whether the display no longer matches the draft settings.

Changing any configuration field after a completed build:

- sets `dirty = true`;
- clears certification (including `QR VERIFIED` and the capture);
- keeps the old world visible with an explicit note that it is the previous world;
- keeps the topbar payload showing the **built** world, not the draft.

The site selector also shows compatibility and minimum-size warnings before generation. The topbar and certifications never silently attribute the old world to new settings.

---

## 8. Exports

All exports read the completed `liveWorld`:

- **GLB** — `GLTFExporter`, vertex colours, normals, surface mesh.
- **PLY** — hand-written binary little-endian PLY.
- **STL** — hand-written binary STL.
- **Sponge v3** — custom NBT writer, YZX varint data, gzip via `CompressionStream`; palette keys are full block-state strings.
- **Standalone HTML** — a single self-contained WebGL 2 viewer with embedded shell data, atlas and runtime.

Surface exports include exposed faces only and centre the model at the origin in X/Z. Water is excluded from surface meshes and included in the schematic volume. The HTML export is also shell-only; the Sponge schematic is the lossless full-volume export. See [asset-pipeline.md](asset-pipeline.md).

---

## 9. Failure boundaries

- Encoding errors (empty payload, payload too large, matrix too large for all site sizes) are caught and shown in the Encode panel.
- Worker errors reject the generation request; the UI never leaves a spinner running without a message.
- A projection conflict or software decode failure sets `Certification failed` before construction.
- A live capture failure leaves the status failed with the reason and never shows `QR VERIFIED`.
- Export buttons are disabled until the engine reports `complete`.
- HTML export rejects an empty world instead of writing a blank viewer.
- Explore Mode handles missing pointer lock and Escape without trapping the cursor.
- A site that cannot fit its minimum size is reported before generation rather than silently shrunk.

---

## 10. Source map

| Concern | File |
| --- | --- |
| QR matrix and finder roles | `src/lib/qr/matrix.ts` |
| Projection contract | `src/lib/qr/projector.ts` |
| Software top-view render/decode | `src/lib/qr/software-render.ts` |
| Image upload decode | `src/lib/qr/image.ts` |
| Site and cell sizing | `src/lib/world/site.ts` |
| Site definitions and compatibility | `src/lib/sites/*` |
| Dense world / YZX indexing | `src/lib/world/VoxelWorld.ts` |
| Terrain and outer features | `src/lib/world/terrain.ts`, `site-features.ts` |
| City and streets | `src/lib/world/city.ts` |
| Style grammar and architecture | `src/lib/blocks/styles.ts`, `styles-*.ts`, `src/lib/world/architecture.ts` |
| Landmarks / buildings | `src/lib/world/landmarks.ts`, `buildings.ts` |
| Class-aware materials | `src/lib/world/paint.ts`, `src/lib/blocks/registry.ts` |
| Semantic block states | `src/lib/blocks/state.ts`, `src/lib/world/semantic.ts` |
| Task graph | `src/lib/construction/plan.ts` |
| Live construction | `src/lib/construction/engine.ts` |
| Worker protocol | `src/lib/worker/protocol.ts`, `src/workers/generate.worker.ts` |
| Render payload | `src/lib/world/render-payload.ts` |
| Textures | `src/lib/render/textures.ts` |
| Live certification | `src/components/viewer/TopViewCertifier.tsx` |
| Exports | `src/lib/export/*`, `src/lib/client/export-service.ts` |
| HTML generator / runtime | `src/lib/export/html.ts`, `html-runtime.ts` |
