# Asset Pipeline

QR Craft ships **no downloaded art assets**. Every texture, mesh and downloadable file is produced locally from code and data in this repository.

This document covers:

1. the block registry that drives colour, states and QR class;
2. the 53-style material/grammar registry;
3. the procedural 16 × 16 textures used by the viewer and HTML export;
4. the instanced world renderer and construction reveal;
5. the surface, voxel and standalone HTML export pipelines;
6. provenance and extension rules.

---

## 1. Block registry

`src/lib/blocks/registry.ts` is a **curated registry of 178 blocks**. Each entry has:

| Field | Purpose |
| --- | --- |
| `id` | Namespaced id such as `minecraft:deepslate_tiles` |
| `displayName` | Human-readable label |
| `projection` | `dark`, `light` or `neutral` for QR purposes |
| `color` | Representative top-face colour; also used by the software optical raster |
| `texture` | Procedural pattern family |
| `solid` | Collision and meshing behaviour |
| `transparent` | Water-like rendering |
| `emissive` | Optional glow strength |

The registry is deliberately finite. New blocks must be:

- real Minecraft 1.21.4 block ids (validated by `src/tests/blocks.test.ts` using `minecraft-data`, a dev-only dependency);
- visually separable across the QR dark/light divide (dark materials below 0.2 relative luminance, light materials above 0.5);
- referenced only by registered ids from every style palette (also enforced by the same test).

Using factual block identifiers is interoperability naming, not a claim of affiliation. No Mojang texture files, models or other assets are included.

### Semantic block states

`src/lib/blocks/state.ts` and `src/lib/world/semantic.ts` produce full 1.21.4 state strings for doors, stairs, slabs, fences, walls, trapdoors, lanterns, soul lanterns, iron bars and chains. Examples:

```text
minecraft:dark_oak_stairs[facing=east,half=top,shape=straight,waterlogged=false]
minecraft:stone_brick_wall[east=tall,north=tall,south=tall,up=true,waterlogged=false,west=tall]
minecraft:birch_door[facing=west,half=lower,hinge=right,open=false,powered=false]
```

The QR projector and paint helpers compare **base block ids**, because the top projection only needs the material class. The renderer, schematic and HTML palette retain the full state string. `src/tests/semantic-states.test.ts` validates every emitted property against `minecraft-data` 1.21.4. Wall side values are `none` / `tall`, never booleans.

---

## 2. Style registry and palettes

`src/lib/blocks/styles.ts` defines **53 architectural styles**. The first three are the preserved V1 styles:

- **High Gothic** (`gothic`);
- **Royal Marble** (`royal`);
- **Rustic Timber** (`rustic`).

The other 50 span medieval, classical, Asian, regional and fantasy categories. Definitions live in `styles-medieval.ts`, `styles-classical.ts`, `styles-asian.ts`, `styles-regional.ts` and `styles-fantasy.ts`.

Each `StyleDefinition` supplies:

- a **dark** `MaterialSet` and a **light** `MaterialSet` — ground, foundation, wall, roof, roof edge, trim, accent, window, door, optional side-facing metal;
- a **structural** palette — wall/foundation materials that do not vary by QR class;
- roof grammar (`stepped`, `gable`, `hip`, `flat`, `dome`, `pagoda`, `spire`, `sawtooth`, `clerestory`, `ruined`);
- wall grammar (`solid`, `buttressed`, `timber`, `arcade`, `rusticated`, `panelled`, `pilastered`, `overgrown`);
- window grammar (`lancet`, `round`, `grid`, `slit`, `oriel`, `arched`, `rose`, `shoji`, `ruined`);
- door grammar (`arched`, `double`, `gate`, `portcullis`, `round`, `timber`, `screen`);
- detail grammar (chimneys, dormers, balconies, banners, planters, columns, arches, weathering);
- proportions and lighting grammar.

Top surfaces take materials from the dark/light set selected by the module. Side faces use the structural palette or side-facing fields. This keeps the city legible as architecture while preserving the QR projection. `src/tests/palette-projection.test.ts` enforces that every top-surface field in every style carries the correct projection class.

The quality tier (`standard`, `detailed`, `showcase`) controls how many façade, roof and courtyard passes run. It never changes the QR matrix or the class of a top surface.

### Compatibility

Each site definition lists `excellentStyles` and `goodStyles`. `src/lib/sites/compatibility.ts` turns those lists into a display badge and score. Compatibility is a recommendation, not a hard restriction; the UI still allows an unusual combination and says so.

The representative `color` is shared between the viewer material and the software top-view raster. That is intentional: the optical reference check samples the same colour data the renderer uses, rather than an unrelated test palette.

---

## 3. Procedural textures

`src/lib/render/textures.ts` exposes:

- `buildTexturePixels(block)` — a pure deterministic 16 × 16 RGBA `Uint8Array`;
- `createProceduralTexture(block)` — wraps those pixels in a `THREE.CanvasTexture`;
- `getBlockTexture(blockId)` / `disposeBlockTextures()` — live-viewer cache management.

The same pixel builder feeds both the live renderer and the standalone HTML atlas, so the offline viewer is not a second art implementation.

- The texture is seeded from a stable hash of the block id, so it is identical across reloads.
- The base colour comes from the registry.
- A pattern family is drawn per texel:
  - `stoneBrick` / `tile` — staggered mortar lines;
  - `cobble` — irregular cell shading;
  - `planks` — horizontal board seams;
  - `log` — vertical grain;
  - `leaves` — clustered light/dark speckles;
  - `grass`, `dirt`, `gravel`, `sand` — seeded grain;
  - `concrete`, `snow`, `mineral` — subtle variation;
  - `fabric`, `metal`, `thatch` — woven/banded patterns;
  - `water` — sine-wave ripple;
  - `glow` — radial falloff;
  - `crystal`, `lava`, `glass`, `bars` and `flower` — V2 families that use seeded variation where the style needs them.
- A subtle darker one-pixel frame helps adjacent cubes read as separate blocks.
- Texture settings: nearest magnification, nearest-mipmap linear minification, 4× anisotropy, sRGB colour space, repeat wrapping.

These textures are original procedural output. They are not sampled, recoloured or derived from Minecraft textures.

---

## 4. World rendering and reveal

`src/lib/world/render-payload.ts` prepares a compact render payload:

- exposed blocks only;
- `positions` (Uint16 x/y/z triplets);
- `paletteIndices` into the completed world palette;
- `orders` — the construction order, or `-1` for pre-existing terrain.

The static terrain is taken from the bare site. Planned blocks are omitted there and re-added from the completed world with their placement order. There is no duplicate copy of the city in the scene.

`WorldMesh` groups instances by palette index and creates one `THREE.InstancedMesh` per material:

- shared `BoxGeometry(1, 1, 1)` per group;
- one `MeshLambertMaterial` per block id, with the procedural texture;
- palette entries that carry bracket states are resolved to their base id for texture lookup;
- transparent blocks get opacity 0.74, depth-write off and double-sided faces;
- emissive blocks receive a small emissive colour boost;
- a custom vertex attribute `aOrder` is compared with the shared `uApplied` uniform in the vertex shader.

`revealUniform.value` is updated from `engine.applied` every frame. An instance whose order is greater than the applied count collapses to a zero-scale point. The result is a literal reveal of the same voxel state the engine is mutating, not an independent animation.

No model files, texture atlases, HDR maps or fonts are downloaded. The sky is a shader gradient, lights are standard Three.js lights, and the visual sea is a plane generated in code.

---

## 5. Export pipeline

All exports read the completed `liveWorld` after construction. Exports are disabled before that point because a partial world would not carry the full QR projection.

### Surface mesh

`src/lib/export/mesh.ts` builds a culled surface mesh:

- six possible faces per solid block;
- a face is emitted only when the neighbouring cell is not opaque;
- per-vertex position, normal and colour;
- one quad (four vertices, two triangles) per exposed face;
- coordinates keep the generator axes and are centred in X/Z for common viewers.

Water and other non-opaque blocks are excluded from surface meshes. They are included in the schematic volume.

### GLB

`src/lib/export/glb.ts` uses Three.js `GLTFExporter` to write binary glTF with position, normal, colour and index buffers. It preserves geometry and vertex colours without an external material library. The browser smoke test downloads a real GLB and checks its size.

### PLY and STL

`src/lib/export/mesh-formats.ts` writes:

- **binary little-endian PLY** with positions, normals and per-vertex RGB;
- **binary STL** with triangles and normals, geometry only.

Header layout, byte counts and triangle counts are checked in `src/tests/exports.test.ts`.

### Sponge schematic v3

`src/lib/export/schematic.ts` writes a `.schem` file compatible with the public Sponge Schematic v3 layout:

- root compound `Schematic`;
- palette containing every world palette entry, with air at index 0 and full block-state strings as keys;
- YZX-ordered varint block data, including air and water;
- `DataVersion = 4189` (Minecraft 1.21.4 data);
- metadata: name, author, description, seed, payload, site, style, quality and creation date (`QRCraftSite`, `QRCraftStyle` and `QRCraftQuality` alongside `QRCraftSeed` and `QRCraftPayload`).

`src/lib/export/nbt.ts` is a small big-endian NBT writer. Tests parse the uncompressed NBT with `prismarine-nbt` and inflate the runtime gzip with Node's zlib. At runtime, the browser uses `CompressionStream("gzip")`.

### Standalone HTML

`src/lib/export/html.ts` writes one self-contained `.html` document. It contains:

- the **exposed block shell** as base64-packed little-endian Uint16 x/y/z offsets, grouped by palette entry;
- a palette of base block ids, display names, transparency/alpha and emissive strength;
- an RGBA texture atlas built from `buildTexturePixels()`, at most 16 tiles wide, with rows reversed for WebGL's bottom-up upload;
- world metadata: title, payload, seed, site, style, quality, summary, dimensions, module count, cell size, building/structure counts, block count, material count and generation timestamp;
- an embedded WebGL 2 runtime and CSS with no imports or module loading;
- a Content-Security-Policy of `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'`;
- Top, Front, Isometric and Reset camera presets; drag orbit, wheel zoom, right-drag/Shift-drag pan and keyboard shortcuts `1`, `2`, `3`, `0`;
- the required QR Craft, Mojang and DENSO WAVE attribution.

The exported viewer has no import path back into QR Craft, no Explore Mode, no construction playback and no certification. It is a display artifact. Because it stores the exposed shell only, interior and submerged blocks are omitted; the Sponge schematic remains the lossless full-volume export.

The HTML writer is deterministic for the same world and metadata, rejects an empty world, and escapes payload/label text in both markup and embedded JSON. `src/tests/html-export.test.ts` checks the embedded data, CSP, absence of external references and byte determinism; `src/tests/html-export.spec.ts` opens a real file through `file://` in an offline browser and exercises every camera control.

### Formats not advertised

OBJ, VOX and other candidates have no tested writer in this repository, so the UI does not offer them. Adding a format means adding a writer, a test that validates its bytes, and only then an entry in `EXPORT_FORMATS`.

---

## 6. Provenance summary

| Asset | Source | License |
| --- | --- | --- |
| Block textures | Generated at runtime by `src/lib/render/textures.ts` | Original code, MIT |
| HTML atlas and viewer runtime | Generated by `src/lib/export/html.ts` and `html-runtime.ts` | Original code, MIT |
| 3D world geometry | Generated by this repository | Original code, MIT |
| Sky and sea | Shader/plane code in this repository | Original code, MIT |
| UI icons | `lucide-react` | ISC |
| Fonts | System font stacks only | No font files shipped |
| Block names | Factual identifiers from Minecraft 1.21.4 data | Naming/interoperability only |

No Mojang or Microsoft asset is redistributed. See [licensing.md](licensing.md).

---

## 7. Adding blocks or texture families

1. Add the block with `B(...)` in `src/lib/blocks/registry.ts`.
2. Use a real 1.21.4 id and a deliberate QR class and colour.
3. Use an existing `TextureKind`, or add a new kind to the union and a matching branch in `drawPattern()`.
4. If the block appears on a city top surface, make sure its luminance respects the dark/light thresholds.
5. Reference it from a style palette only if it belongs there.
6. If it needs a semantic state, add the mapping/helper in `src/lib/world/semantic.ts` and a validated property set in `src/tests/semantic-states.test.ts`.
7. Run:

```bat
npm run typecheck
npm run lint
npm test
```

The block registry test will reject unknown ids, poor contrast and palette references to unregistered blocks. The generation test will catch projection regressions on the default world. See [adding-a-theme.md](adding-a-theme.md) for adding a full style.
