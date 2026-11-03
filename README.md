# QR Craft

**Type a URL. Get a Minecraft-style world whose rooftops are a real, scannable QR code.**

QR Craft is a local Next.js application that turns a URL, text payload, or uploaded QR image into a deterministic Minecraft-style world. It ships **24 sites** — from an alpine citadel and a coastal fortress to a floating sky kingdom — and **53 architectural styles**, while preserving the original Hamlet / Kingdom / Grand Kingdom / Monumental valley worlds. The city is not decorated with a QR overlay: every top-down column inside the city takes its surface material from a QR module, so the actual rendered top view decodes back to the exact payload.

Everything runs on your machine. There are no AI services, no generation APIs, no accounts, and no runtime network calls.

---

## What it actually does

1. Encodes the payload as a canonical QR matrix (`qrcode`, error correction M, 4-module quiet zone).
2. Chooses a site, size and cell scale large enough for every module to become real architecture.
3. Generates terrain, water, vegetation and outer landmarks for that site; builds a fortified core with three finder-pattern landmarks, streets, houses, a market and decoration; applies the selected style grammar and quality passes.
4. Verifies the projection column by column and decodes a real software-rendered top view with ZXing.
5. Sends the completed site to the main thread, reconstructs the voxel world and builds it live through its dependency-ordered construction graph.
6. Captures the **live WebGL scene** from an orthographic top camera, reads the pixels back, and decodes them with ZXing before showing `QR VERIFIED`.
7. Lets you walk the same voxel world in Explore Mode and export it as GLB, PLY, STL, a Sponge schematic or a standalone offline HTML viewer.

The construction animation is not a replay. The builder applies real placements to the same `VoxelWorld` used for exploration, verification and export.

---

## Quick start (Windows)

Requirements: **Node.js 20.9 or newer** and npm.

Double-click **`start.bat`**.

The launcher:

- checks that Node.js and npm are available;
- installs dependencies if `node_modules` is missing;
- refuses to start if port 3000 is already in use;
- builds the production app and shows build errors in the window;
- starts the server in a separate visible **QR Craft Server** window;
- waits for an actual HTTP 200 response;
- opens `http://127.0.0.1:3000` in your browser.

The first launch takes longer because of the production build. Keep the server window open while using the app.

Set `QRCRAFT_NO_BROWSER=1` before running `start.bat` to skip opening the browser.

### Manual start

```bat
npm ci
npm run dev
```

Then open `http://localhost:3000`.

For a production run:

```bat
npm run build
npm run start
```

---

## How to use it

1. Enter a URL or text, or upload a PNG / JPEG / WebP QR image. Images are decoded locally and fill the payload field.
2. Choose a seed, site, size, architectural style, quality tier and density. `Generate` is disabled while a build is running.
3. Watch the builder walk the site and construct the world. Pause, resume, cancel or change speed at any time.
4. Wait for construction to finish. Certification starts automatically; you can also run it again from **Verify**.
5. Open **Top-down** to inspect the real top projection.
6. Open **Explore**, click to lock the pointer, and walk through the city.
7. Export the completed world from the **Export** tab.

Changing payload, seed, site, size, style, quality or density after a build marks the canvas as showing a previous world, clears `QR VERIFIED`, and explains that you must generate again. The old world is not silently relabeled.

---

## Verification, not decoration

The badge never comes from the QR matrix alone.

| Status | What it means |
| --- | --- |
| **Not tested** | No world has been generated, or certification has not run. |
| **Matrix matched** | Every projected column matches its module **and** an independent software render of the real top projection decoded to the exact payload. The live camera has not certified it yet. |
| **Rendered image decoded** | The live WebGL capture decoded to the exact payload, but at least one robustness variant failed. |
| **Robustness tests passed** | The live WebGL top view decoded exactly, and all four scan-scale variants decoded to the same payload. |
| **Certification failed** | A stage failed. The panel gives the reason and never shows `QR VERIFIED`. |

`QR VERIFIED` is shown only after a rendered image decodes to the exact requested payload. The Verify panel includes the actual offscreen capture and its dimensions so you can inspect what was decoded.

The browser test is a real optical decode, but it is not a promise that every phone, printer, angle and lighting condition will scan. See [docs/qr-certification.md](docs/qr-certification.md) for the exact contract and limits.

---

## What gets built

The default site (seed 1337, 192², Kingdom, High Gothic, Detailed, Balanced) currently produces:

- QR version 3, 29 modules (excluding the quiet zone), 4 blocks per module, a 148² city;
- 21,904 projected columns, all matching their target module;
- 119 structures, 110 buildings, 6 towers, 528 construction tasks and 90,868 builder placements;
- 826,253 solid world blocks, of which 133,935 are visible/exposed, with a tallest column at Y 64;
- High Keep, East Bastion and Grand Cathedral placed on the three finder patterns;
- castle curtain walls, gatehouses, drum towers, market square, market stalls, processional avenue, streets, houses, manors, rowhouses, lamps, trees and a carved moat with a stone bridge.

Larger legacy sites add outer fields and a hamlet when there is genuine land beyond the moat. The 192² legacy site has no spare margin, so it does not claim either feature. The V2 sites add their own terrain, water, vegetation and outer landmarks. The build brief never names an outer feature that the generator did not actually place; site cards describe the wider theme, while built-feature names come from the outer-feature kinds.

### Sites, styles and quality

There are **24 sites** in four groups:

- **Legacy:** Hamlet, Kingdom, Grand Kingdom, Monumental.
- **Realms:** Alpine Citadel, Coastal Fortress, Imperial Capital, Cathedral City, Riverside Trade Town, Highland Monastery, Dwarven Mountain Hold, Ancient Temple Valley.
- **Wilds:** Enchanted Forest, Giant Tree Sanctuary, Mushroom Vale, Crystal Cavern Realm, Snowbound Village, Volcanic Fortress.
- **Frontier:** Pirate Harbor, Desert Oasis City, Garden Citadel, Steampunk Industrial Port, Jungle Temple Ruins, Floating Sky Kingdom.

The four legacy ids keep their V1 default sizes:

| Site | Default size | Typical use |
| --- | ---: | --- |
| Hamlet | 128² | Short payloads and faster builds |
| Kingdom | 192² | Default, dense fortified city |
| Grand Kingdom | 256² | More land, fields and an outer hamlet |
| Monumental | 320² | Large payloads and long builds |

If a payload needs a larger site to keep at least 3 blocks per module, QR Craft upgrades the size automatically and says so. A site with a dominant landmark may also enforce a larger minimum size before generation. V2 sites additionally reserve a 12-block landscape band for their outer landmarks; at 192² with the default payload that means 3 blocks per module (111² city) instead of the legacy 4-block/148² layout. The field/hamlet and outer-landmark passes exclude each other, and the brief names only the feature kinds that were actually built.

There are **53 architectural styles** across Medieval, Classical, Asian, Regional, Fantasy, Industrial and Nature-inspired categories. The first three are the preserved identities **High Gothic**, **Royal Marble** and **Rustic Timber**. Styles change roof, wall, window, door, detail and lighting grammar, not only colours, while every top surface preserves the QR dark/light class.

There are **3 quality tiers**:

| Tier | What it adds |
| --- | --- |
| Standard | Core architecture, doors, windows, roofs and essential lighting |
| Detailed | Façade framing, roof variation, entrance paths, planters, balconies and more lighting |
| Showcase | Fine trims, extra roof systems, courtyard decoration, richer lighting and landmark detail |

The tiers are real construction plans. For the same Kingdom / Royal / seed 2024 / Dense world, world blocks rise from 825,377 (Standard) to 826,201 (Detailed) to 827,401 (Showcase), and visible blocks rise from 133,093 to 133,293 to 134,251.

---

## Explore Mode

Enter Explore from the mode switch or **Walk the site**.

| Input | Action |
| --- | --- |
| Click | Lock pointer |
| Mouse | Look |
| `W A S D` or arrow keys | Move |
| `Space` | Jump / swim up |
| `Shift` | Sprint |
| `R` | Respawn at the bridge |
| `Esc` | Release pointer lock |
| **Leave explore** | Return to Showcase |

Movement uses gravity, per-axis collision, a one-block auto-step, water drag and a footprint support check. The same world state is used everywhere. See [docs/exploration-mode.md](docs/exploration-mode.md).

---

## Exports

Only formats with a working writer and a passing test are advertised.

| Format | Contents | Notes |
| --- | --- | --- |
| **GLB** | Coloured surface mesh, normals, vertex colours | Download is exercised by the browser smoke test. |
| **PLY** | Binary coloured mesh, normals, per-vertex RGB | Header and byte sizes are unit tested. |
| **STL** | Binary triangulated surface, geometry only | Triangle count and binary layout are unit tested. |
| **Sponge schematic (`.schem`)** | Full voxel volume, palette, air, water, full block states | Gzipped Sponge Schematic v3, `DataVersion` 4189; parsed with `prismarine-nbt` in tests. |
| **Standalone HTML (`.html`)** | Exposed shell, embedded RGBA atlas, metadata, WebGL 2 viewer | Single file, offline CSP, no external requests; Top / Front / Isometric / Reset plus orbit, zoom and pan. Shell-only, not a lossless volume. |

Exports unlock only after construction completes. A partial build would produce an incomplete QR projection, so there is no "export anyway" control.

OBJ, VOX and other formats were considered but are not advertised because there is no tested writer.

---

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint 9 flat config with `eslint-config-next` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and integration tests |
| `npm run test:smoke` | Playwright production tests on port 3100 (app journey + offline HTML viewer) |

`npm run test:smoke` builds the app and serves it on port 3100 so it cannot collide with a normal dev server. It uses the locally installed Chrome channel; no Playwright browser download is required.

---

## Repository map

```text
src/app/                  Next.js shell, metadata, global styles
src/components/           UI panels and the React Three Fiber viewer
src/components/viewer/    World mesh, camera, builder, certification, explore controller
src/lib/qr/               Matrix, projection contract, software render, ZXing decode, statuses
src/lib/sites/            Data-driven 24-site catalog, compatibility and legacy sites
src/lib/blocks/           Block registry, 53-style grammar, semantic state helpers
src/lib/world/            Site layout, terrain, site features, city, landmarks, architecture, VoxelWorld
src/lib/construction/     Task compiler and live ConstructionEngine
src/lib/export/           Surface meshing, PLY/STL, NBT, Sponge v3, GLB, standalone HTML
src/lib/explore/          Pure, testable first-person physics
src/lib/render/           Procedural textures and the construction reveal uniform
src/workers/              Generation Web Worker
src/tests/                Vitest suites and the Playwright acceptance test
scripts/                  Windows launcher helpers
docs/                     Architecture and subsystem documentation
```

---

## Testing status

The repository contains:

- **9 Vitest files, 40 tests**, covering QR projection and optical decode, terrain water/fields, V2 landscape reservation and landmark clipping, block-ID and semantic-state validation, QR contrast, pure exploration physics, PLY/STL/Sponge exports, all 24 sites, all 53 styles, all three quality tiers and the standalone HTML payload;
- **2 Playwright acceptance tests** — the live journey (generate, certify, explore, export GLB/Sponge, upload, dirty state) and a real offline `file://` HTML viewer test (WebGL 2, all camera presets, orbit/zoom/pan, no network requests, no console errors).

The exact commands and what each test proves are listed in [docs/testing.md](docs/testing.md).

---

## Honest limits

- Certification proves that a rendered image of this world decodes with ZXing under the tested scan scales. It is not a physical print/camera certification, and it says nothing about a specific phone, print size or lighting condition.
- The live capture is tested at 1536 × 1536 and decoded after resampling to scan-scale images. The 1536² image alone does not decode reliably; the success path uses the same rendered capture at 512, 448 and 384 pixels plus a blurred 512 variant. The pre-construction software decode uses a bounded raster (`maxEdge: 600` by default). This is documented rather than hidden.
- The scene requires WebGL. Very old GPUs or disabled hardware acceleration may render slowly or fail certification.
- Explore Mode is first-person only and does not support touch or mobile controls.
- The visual sea is a backdrop. The real swimmable water is the legacy moat, or the water feature declared by a V2 site (harbour, oasis, canals, lava channels, and so on).
- Fields and the outer hamlet only exist on legacy sites with enough land beyond the moat.
- **The four legacy site ids share one generator.** Hamlet, Kingdom, Grand Kingdom and Monumental produce identical worlds at the same actual size. This is deliberate V1 preservation; only the 20 new sites are guaranteed distinct.
- The 20 new sites reuse the same city grammar with different terrain, landmark, vegetation, water and composition parameters. They are not 24 hand-authored games.
- The standalone HTML export is **shell-only and display-only**. It omits interiors and submerged hidden blocks, cannot be re-imported into QR Craft, and has no Explore Mode or construction playback. The Sponge schematic is the lossless voxel export.
- The HTML viewer has no “hide UI” control; the HUD stays visible.
- Exporting a 320² world is memory-intensive because the full voxel volume is held in the browser.

---

## Assets and licensing

All block textures are **original procedural 16 × 16 textures generated in code at runtime**. No Minecraft texture files, models, sounds, fonts or other Mojang assets are included. Block identifiers are used as factual interoperability names, not as a claim of affiliation.

The project code is released under the MIT License. Third-party dependencies retain their own licenses, including ZXing (Apache-2.0), Three.js (MIT), Next.js/React (MIT) and qrcode (MIT). See [docs/licensing.md](docs/licensing.md) and [LICENSE](LICENSE).

Minecraft is a trademark of Mojang Studios. QR Craft is an independent project and is not affiliated with or endorsed by Mojang or Microsoft.

---

## Documentation

- [Architecture](docs/architecture.md)
- [QR certification](docs/qr-certification.md)
- [World generation](docs/world-generation.md)
- [Asset pipeline](docs/asset-pipeline.md)
- [Builder system](docs/builder-system.md)
- [Exploration mode](docs/exploration-mode.md)
- [Testing](docs/testing.md)
- [Adding a theme](docs/adding-a-theme.md)
- [Licensing and provenance](docs/licensing.md)
