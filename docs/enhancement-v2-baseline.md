# Enhancement V2 — Baseline and Architecture Audit

Recorded before any V2 implementation work. This is the reference for preserving existing behaviour.

## 1. Existing behaviour

| Area | Status |
| --- | --- |
| QR encoding, upload decoding, canonical matrix | Working |
| Column projection check | Working, zero conflicts on default |
| Software top-view ZXing decode | Working, exact payload |
| Live WebGL certification | Working, `QR VERIFIED` after construction |
| Live construction and task graph | Working |
| Explore Mode and pointer lock | Working |
| GLB / PLY / STL / Sponge exports | Working and tested |
| Default 192² world | 119 structures, 530 tasks, 91,797 placements |

Existing size presets:

| Label | Requested size | Actual behaviour |
| --- | --- | --- |
| Hamlet | 128 | Upgrades to 192 when the payload needs it |
| Kingdom | 192 | Default |
| Grand Kingdom | 256 | Larger cells and more terrain |
| Monumental | 320 | Largest site |

There were no separate site IDs in V1. The four presets were selected only by world size. V2 introduces site IDs without removing the four legacy presets.

## 2. Measured V1 baseline

Default payload `https://example.com/qrcraft`, seed 1337, High Gothic, Balanced, from `generateWorld()` in Node:

| Requested | Actual | Cell | Buildings | Structures | Towers | Tasks | Placements | World blocks | Visible | Conflicts | Decode | Tallest |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 128 | 192 | 4 | 110 | 119 | 6 | 530 | 91,797 | 827,224 | 133,826 | 0 | pass | 58 |
| 192 | 192 | 4 | 110 | 119 | 6 | 530 | 91,797 | 827,224 | 133,826 | 0 | pass | 58 |
| 256 | 256 | 5 | 110 | 119 | 6 | 559 | 144,654 | 1,456,925 | 214,744 | 0 | pass | 60 |
| 320 | 320 | 7 | 110 | 119 | 6 | 640 | 292,721 | 2,346,243 | 332,600 | 0 | pass | 62 |

Generation time on the baseline machine: 0.9 s (192²), 2.3 s (256²), 10.5 s (320²), first run 1.5 s including warm-up.

Baseline gate:

- `npm run typecheck`: pass;
- `npm run lint`: pass;
- `npm test`: 5 files, 21 tests pass;
- `npm run build`: pass;
- `npm run test:smoke`: 1 pass.

## 3. Module classification

### PRESERVE

| Module | Reason |
| --- | --- |
| `src/lib/qr/matrix.ts` | Canonical matrix and payload contract |
| `src/lib/qr/projector.ts` | Authoritative projection check |
| `src/lib/qr/software-render.ts` | Optical software decode |
| `src/lib/qr/image.ts` | Local image decoding |
| `src/components/viewer/TopViewCertifier.tsx` | Only path that may set `QR VERIFIED` |
| `src/lib/construction/engine.ts` | Real live construction executor |
| `src/lib/explore/physics.ts` | Tested movement/collision |
| Existing export writers | Working and tested |
| `start.bat` launcher | Tested end-to-end |

### EXTEND

| Module | Change |
| --- | --- |
| `src/lib/world/site.ts` | Keep dimensions, add site definition linkage |
| `src/lib/world/generate.ts` | Thread site, quality and outer landmarks |
| `src/lib/world/terrain.ts` | Add parameterized terrain profiles and site features |
| `src/lib/world/city.ts` | Add site composition rules and new landmark labels |
| `src/lib/world/buildings.ts` | Add style-oriented roof/facade/door/window systems |
| `src/lib/world/landmarks.ts` | Add style roof grammar and site labels |
| `src/lib/blocks/registry.ts` | Add materials, block states and style grammar |
| `src/lib/world/types.ts` | Add site, quality, generation version metadata |
| `src/lib/world/director.ts` | Site-aware honest brief |
| Worker protocol / store / UI | Site, quality, HTML export, filters |
| Tests | Site/style/detail/export regression coverage |

### REFACTOR

| Module | Reason |
| --- | --- |
| `src/lib/world/recorder.ts` | Replace linear duplicate lookup with an index map |
| `src/lib/world/paint.ts` | Resolve block-state base IDs through the registry |
| `src/lib/export/mesh.ts` and viewers | Handle stateful block IDs by base block |
| New style registry | Split 53 styles out of `registry.ts` while preserving exports |
| New site registry | Data-driven definitions, not 24 generator branches |

### REPLACE ONLY IF NECESSARY

None of the working QR, certification, builder, exploration or export subsystems is replaced. The V2 work adds modules around them.

## 4. Existing weaknesses to address

- Only three material palettes and one roof grammar shape variation.
- Doors are two solid wall blocks, not door halves.
- Windows are glowstone blocks, not framed glass.
- Roofs use full blocks only; no stairs, slabs, eaves or dormers.
- No façade or context decoration engine.
- No construction-quality selector.
- No HTML export.
- One landscape grammar (wooded valley + moat) for all sizes.
- No site compatibility metadata.

## 5. V2 invariants

1. QR matrix, quiet zone and coordinate conventions do not change.
2. Every city column's top block remains the module's dark/light class.
3. The live WebGL decode remains the only certification source.
4. Construction mutates the same world used for exploration and export.
5. Existing export formats remain available and tested.
6. Site/style/quality additions are deterministic.
7. Anything advertised in the UI has a real generator path.

## 6. V2 compatibility strategy

- Site IDs are new; the four legacy presets remain as site IDs `hamlet`, `kingdom`, `grand-kingdom`, `monumental`.
- Existing style IDs `gothic`, `royal`, `rustic` remain unchanged.
- `WorldConfig` gains `site` and `quality` with defaults matching V1 (`kingdom`, `detailed`).
- A generation version string is added to results and exports. V1 saved worlds are not persisted by the app, so there is no stored-world migration burden; exported metadata identifies the version that created it.
- Existing size IDs remain 128/192/256/320.

## 7. First V2 test target

Before feature work, the V1 acceptance test must still pass unchanged. After each phase:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

The final phase repeats the Playwright acceptance test and adds `file://` HTML export verification.

## 8. Final V2 state (2026-11-02)

The historical sections above stay as the V1 reference. This section records what shipped and what was actually measured on the final tree.

### Delivered surface

| Area | V2 result |
| --- | --- |
| Sites | **24** — four preserved V1 presets plus 20 new data-driven sites |
| Styles | **53** — three preserved V1 styles plus 50 new styles across five category files |
| Block registry | **178** curated 1.21.4 block ids, including stairs, slabs, fences, walls, trapdoors, doors and lanterns |
| Quality tiers | **Standard**, **Detailed**, **Showcase**, each compiling a different real construction plan |
| Semantic states | Full 1.21.4 state strings for doors, stairs, slabs, fences, walls, trapdoors, lanterns, soul lanterns, iron bars and chains |
| HTML export | Single-file offline WebGL 2 viewer with embedded shell data, procedural atlas, metadata, attribution and camera controls |
| Defaults | `kingdom` + `detailed`, preserving the V1 default intent |

### Measured default worlds

Payload `https://example.com/qrcraft`, seed 1337, High Gothic, Detailed, Balanced, from `generateWorld()` in Node on the final tree:

| Requested | Actual | Cell | Buildings | Structures | Towers | Tasks | Placements | World blocks | Visible | Tallest | Decode |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 128 | 192 | 4 | 110 | 119 | 6 | 528 | 90,868 | 826,253 | 133,935 | 64 | pass |
| 192 | 192 | 4 | 110 | 119 | 6 | 528 | 90,868 | 826,253 | 133,935 | 64 | pass |
| 256 | 256 | 5 | 110 | 119 | 6 | 558 | 140,743 | 1,452,961 | 213,665 | 66 | pass |
| 320 | 320 | 7 | 110 | 119 | 6 | 634 | 278,539 | 2,331,974 | 328,250 | 68 | pass |

The 128 request upgrades to 192 for this payload, so Hamlet and Kingdom intentionally produce the same world. All four legacy site ids use the original valley generator; the 20 new sites are separately asserted to be distinct.

### Quality tiers

Measured with `kingdom`, `royal`, seed 2024, Dense:

| Quality | Tasks | Placements | World blocks | Visible | Buildings | Structures | Towers | Decode |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Standard | 529 | 87,521 | 825,377 | 133,093 | 110 | 119 | 9 | pass |
| Detailed | 548 | 88,345 | 826,201 | 133,293 | 115 | 124 | 12 | pass |
| Showcase | 548 | 89,545 | 827,401 | 134,251 | 115 | 124 | 12 | pass |

The tiers are real, increasing construction passes: total blocks and visible blocks both increase strictly. They add façade framing, roof systems, entrance paths, planters, balconies, courtyard decoration, trims, landmark detail and richer lighting, not just a label.

### HTML export

The default 192 × 84 × 192 Detailed world exported to **1,161,282 bytes** (about 1.11 MiB) with **133,935 exposed blocks**. The file contains:

- base64-packed Uint16 block offsets grouped by palette entry;
- a procedural RGBA atlas generated from the same texture pixels as the live viewer;
- an embedded WebGL 2 runtime with no imports, CDNs or network calls;
- `default-src 'none'`, `connect-src 'none'` and inline-only scripts/styles;
- Top, Front, Isometric and Reset presets, plus orbit, zoom and pan;
- metadata and the required Mojang/DENSO WAVE attribution.

The export is the exposed shell, not the full interior volume. The Sponge schematic remains the lossless voxel export.

### Final validation

- **9 Vitest files, 38 tests passed**;
- **2 Playwright specs passed** — the live app journey and the offline `file://` HTML viewer;
- all 24 sites generate legal, decodable worlds at 128²;
- all 53 styles produce distinct worlds and emit every required semantic state family;
- all three quality tiers produce distinct, increasing plans;
- all semantic helpers pass `minecraft-data` 1.21.4 property validation;
- every top-surface style material passes the projection-class contract;
- typecheck, lint and the production build pass.

### Honest V2 limitations

- The four legacy site ids share one generator and produce identical worlds at the same actual size. This is deliberate preservation, not a presentation bug.
- The 20 new sites are distinct in terrain, landmark, vegetation, water and composition data, but they reuse the same city grammar with different parameters; this is not 24 hand-authored games.
- The HTML viewer is shell-only and display-only. It cannot re-import into QR Craft or replace the Sponge schematic.
- Certification remains rendered-image decoding, not a physical print or phone scan. The software decode uses a bounded raster (`maxEdge: 600` by default) because very large patterned upscales were unreliable.
- No AI services, runtime network calls or downloaded Minecraft assets were added.
- No cross-browser acceptance matrix, performance budget or automated accessibility audit is included.
