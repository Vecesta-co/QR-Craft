# Testing

QR Craft separates fast deterministic tests from the slower browser acceptance runs. This document lists what exists, what it proves, and what it does **not** prove.

---

## 1. Commands

| Command | Runs | Typical time |
| --- | --- | --- |
| `npm run typecheck` | `tsc --noEmit` | a few seconds |
| `npm run lint` | ESLint 9 flat config | a few seconds |
| `npm test` | Vitest, Node environment | about 40 s |
| `npm run build` | Next.js production build | 10–60 s |
| `npm run test:smoke` | Production build + two Playwright specs | about 3 min |
| `npm run dev` | Development server on port 3000 | — |
| `npm run start` | Serve an existing production build | — |

Requirements for the browser tests:

- Node.js 20.9 or newer;
- a locally installed **Google Chrome** (the config uses `channel: "chrome"`, so Playwright browsers do not need to be downloaded);
- port **3100** free (the smoke server) and no other server using `.next` during its build;
- WebGL 2 available in Chrome. The HTML export spec launches Chrome with `--enable-webgl --ignore-gpu-blocklist --use-angle=swiftshader` so the test also works on machines without a hardware GPU.

---

## 2. Unit and integration tests

`npm test` currently passes with **9 files and 40 tests**.

### `src/tests/generation.test.ts` — 1 test

Generates the default acceptance world (192², seed 1337, High Gothic, Detailed, Balanced) and asserts:

- zero projection conflicts;
- `matrixMatched === true`;
- full city coverage;
- an independent software top-projection raster decoded;
- the decoded text equals the payload exactly;
- more than 10 buildings, more than 10 tasks, more than 5,000 placements.

This is the core acceptance gate: the actual voxel top projection must be optically decodable before the browser is involved.

### `src/tests/blocks.test.ts` — 3 tests

- Every block id in the 178-entry registry exists in `minecraft-data` 1.21.4.
- Dark projection materials have relative luminance below **0.2**; light materials are above **0.5**.
- Every material referenced by every one of the 53 style palettes and structural palettes is a registered block.

This protects both interoperability names and the optical dark/light contract.

### `src/tests/terrain.test.ts` — 6 tests

- The moat is open to the sky, with water at the waterline and air above (sea lanterns are allowed one block above).
- The bridge deck is solid at the south gate.
- The 192² legacy site does **not** claim crop fields or an outer hamlet.
- The 256² legacy site has room for fields and a hamlet, and those fields do not overlap the moat or leave the site margin.
- Every V2 default site reserves the landscape band, builds its planned outer landmarks, names them from the built kinds, and keeps fields out of their rectangles.
- Feature writes for the mountain gate, giant tree and oasis are clipped to their reserved rectangles.

These tests exist specifically to prevent features being advertised when they are not generated. They exercise the shared legacy valley path and the V2 landscape reservation; the different V2 site profiles are also covered by the matrix test below.

### `src/tests/explore.test.ts` — 9 tests

Pure physics against real `VoxelWorld` instances:

- spawn on the local surface;
- gravity settles the player;
- jump and landing;
- wall collision;
- one-block auto-step;
- sprint faster than walk;
- water detection, slower movement and shallower jump;
- reset after leaving the site;
- collision radius stays clear of wall faces.

### `src/tests/exports.test.ts` — 4 tests

Using a generated 128² world:

- surface mesh contains only exposed faces, finite positions, valid indices and real vertical extent;
- binary PLY has the exact header counts and byte size (`vertex * 15 + face * 17` after the header);
- binary STL has the exact triangle count and binary size (`84 + triangles * 50`);
- Sponge schematic is valid gzip, parses as NBT, has `Version = 3`, `DataVersion = 4189`, correct dimensions, air at palette index 0, full YZX volume data including first and last block, and the `QRCraftSite` / `QRCraftStyle` / `QRCraftQuality` metadata fields.

The GLB writer is exercised by the browser smoke test, which downloads a real file and checks its size.

### `src/tests/v2-regression.test.ts` — 6 tests

This is the permanent V2 matrix gate:

- asserts exactly **53 complete, unique styles**, their category/version/swatches, and that every palette material is registered;
- asserts exactly **24 complete, unique sites**, with the four V1 presets first and marked legacy;
- generates **all 24 sites** at 128² and asserts zero projection conflicts, full coverage, exact software decode, a legal palette and real construction for each; the 20 new sites must produce mutually distinct worlds that differ from the legacy valley;
- generates **all 53 styles** at 128² and asserts each style changes the world, while every required semantic state family (door, stairs, slab, fence, wall, trapdoor, lantern) is emitted;
- generates **standard, detailed and showcase** for the same site/style/seed and asserts three distinct worlds with strictly increasing total and visible block counts;
- generates the same configuration twice and asserts identical content hash, palette, stats, placement count and decoded payload.

### `src/tests/semantic-states.test.ts` — 4 tests

Exhaustively validates the semantic block-state helpers against `minecraft-data` 1.21.4:

- every stair, slab, fence, wall and trapdoor mapping, for every facing/half/connection combination;
- exact property sets for stairs, slabs, fences, walls, trapdoors, lanterns, soul lanterns, iron bars, chains and both door halves;
- wall side properties are the enum values `none` / `tall`, never booleans;
- every helper output is accepted by the 1.21.4 data model.

Door helpers also prove that a non-door id falls back to `minecraft:oak_door` instead of emitting an invalid block.

### `src/tests/palette-projection.test.ts` — 2 tests

- Every top-surface field in every style palette (`ground`, `foundation`, `roof`, `roofEdge`, `trim`, `accent`) carries the same projection class as the dark/light set it belongs to.
- Side-facing metal ornaments are registered but intentionally exempt from the top-surface class rule.

This catches the subtle bug where a beautiful material choice silently breaks the QR projection.

### `src/tests/html-export.test.ts` — 5 tests

Generates a real world, writes the standalone HTML export and verifies:

- the embedded exposed shell, palette, procedural RGBA atlas and metadata have consistent counts, dimensions and offsets;
- the document is self-contained, has `default-src 'none'` / `connect-src 'none'`, and contains no external scripts, stylesheets, images, fetches or dynamic imports;
- payload, summary and labels are escaped in markup and JSON so data cannot break out of the script;
- the same world and metadata produce a byte-for-byte identical file;
- an empty world is rejected rather than producing a broken viewer.

---

## 3. Playwright acceptance tests

`npm run test:smoke` builds the production app and serves it on **port 3100**. It uses one worker, one retry disabled, a 420-second default test timeout, a 1600 × 1000 viewport and failure screenshots only. There are two specs.

### `src/tests/smoke.spec.ts` — live app journey

1. Loads the app and confirms the default payload and `Not tested` status.
2. Confirms the QR preview canvas rendered actual pixels.
3. Waits for generation, selects **8×**, and waits for construction to finish.
4. Waits for `QR VERIFIED`.
5. Opens **Verify** and checks:
   - the `QR VERIFIED` hero;
   - payload match `Exact`;
   - `4 / 4 variants`;
   - a column-match fact with a real count;
   - the visible top-down capture image.
6. Opens **Top-down** and confirms the inspection note.
7. Enters **Explore**, acquires pointer lock, confirms the crosshair, presses `W`, and asserts the rendered screenshot changed.
8. Presses `Esc`, confirms the lock prompt returns, leaves Explore and returns to Showcase.
9. Downloads GLB and checks the filename and a minimum file size.
10. Downloads the Sponge schematic and checks the filename and a minimum file size.
11. Uploads a generated QR PNG, confirms the payload field updates, the dirty note appears, `QR VERIFIED` is cleared, and the topbar still shows the **built** world's payload.
12. Asserts there were no console errors or page errors.

### `src/tests/html-export.spec.ts` — standalone `file://` viewer

The spec writes a real standalone export to a temporary directory and opens it through a `file://` URL in an **offline** browser context. It verifies:

- the page reaches the interactive viewer with no loading fallback;
- WebGL 2 created a real drawing buffer;
- title, site/style, payload, seed, quality, attribution and stats are embedded and visible;
- **Top**, **Front**, **Isometric** and **Reset** each change the rendered pixels and update the active button;
- left-drag orbit, wheel zoom and Shift-drag pan each change the rendered pixels;
- keyboard shortcuts `1`, `3` and `0` select the same presets;
- no HTTP(S) requests are attempted and no console or page errors occur.

The HTML test uses Chrome plus `--enable-webgl --ignore-gpu-blocklist --use-angle=swiftshader`, so it can run in software rendering. The spec itself does not use the Next.js server; only `smoke.spec.ts` exercises the port 3100 app. The shared Playwright configuration still starts that server for the suite.

### Why port 3100

The smoke server uses a separate port so it never collides with a developer server on 3000. It also runs a production build, which avoids development-only file-watching problems (especially on OneDrive-synced folders).

---

## 4. What is not tested

Be explicit about the boundary:

- **No physical camera or printer test.** Certification is optical decoding of rendered images, not a phone scan.
- **Not every combination.** The matrix suite covers all 24 sites at one size, all 53 styles at one site, and all three quality tiers for one site/style. It does not enumerate 24 sites × 53 styles × 3 qualities × 4 sizes × arbitrary payloads.
- **Legacy aliases are intentionally identical.** `hamlet`, `kingdom`, `grand-kingdom` and `monumental` all use the original valley generator. At the same actual size they produce the same world; only the 20 new sites are asserted to be mutually distinct.
- **No stored golden voxel snapshot.** Determinism is asserted through content hashes, stable stats and decode results, not a checked-in voxel file.
- **No cross-browser matrix.** Both Playwright specs use local Chrome. Firefox and Safari are expected to work but are not part of the acceptance run.
- **No performance benchmark.** Build and construction timing are reported, not enforced.
- **No accessibility audit.** Semantic controls and labels exist, but no automated WCAG scan is included.
- **No GLB structural parse test.** The browser downloads a real GLB and checks size; PLY/STL/Sponge have deeper byte-level unit tests.
- **The HTML export is a viewer shell, not a save format.** It contains exposed blocks only. Interiors, water volumes below the surface and any hidden blocks are omitted; the Sponge schematic is the lossless voxel export. The HTML viewer has no import path back into QR Craft.
- **The HTML viewer is display-only.** It supports camera presets, orbit, zoom and pan, but not Explore Mode, construction playback or certification.
- **The HTML export has no “hide UI” control.** The HUD remains visible in the document.
- **The software decode uses a bounded raster.** `certifyTopView` defaults to `maxEdge: 600`; very large upscales of patterned voxel tops were unreliable in ZXing. This is a real optical decode of the projection, not a matrix-only shortcut.
- **No scanning guarantee for every device.** A successful render says nothing about a specific phone, print size, lighting condition or camera angle.

These are limits, not hidden claims.

---

## 5. Manual verification

Useful checks that complement automation:

1. **Clean install** — remove `node_modules`, run `start.bat`, confirm dependency installation, build, server window and HTTP 200 readiness.
2. **Port conflict** — occupy port 3000, run `start.bat`, confirm a clear error and no half-started server.
3. **Build failure** — temporarily break a TypeScript file, run `start.bat`, confirm the build error stays visible and the launcher pauses.
4. **Pause/resume/cancel** — start a build, pause, confirm progress stops; resume, confirm it continues; cancel, confirm the builder disappears and exports stay unavailable.
5. **Speed** — switch between 1× and 8× and confirm the task order is unchanged.
6. **Sites** — switch between several of the 24 sites at the same size and confirm the terrain, landmark, vegetation and water profiles change as labelled.
7. **Styles** — try several of the 53 styles and confirm roof, wall, window, door and lighting geometry changes, not only colours.
8. **Quality tiers** — generate Standard, Detailed and Showcase for the same site/style/seed and confirm the block counts and visible detail increase.
9. **Top-down** — confirm the QR is crisp and the moat, bridge and landmark footprints are visible.
10. **Explore** — walk the bridge into the city, climb a step, jump, enter the moat, swim, press `R`.
11. **Dirty state** — change payload, seed, site, style or quality after verification and confirm the badge clears, the canvas note appears and the topbar keeps the old payload.
12. **Upload** — upload a PNG, JPEG and WebP QR image and confirm each decodes locally.
13. **Exports** — open each file in a suitable viewer: GLB in Windows 3D Viewer/Blender, PLY in MeshLab/Blender, STL in a slicer, `.schem` in a Sponge-aware tool.
14. **HTML export** — download the `.html`, disconnect the network, open it from the file system, and exercise all four camera presets plus orbit, zoom and pan.

---

## 6. Reproducing the full gate

From a clean shell:

```bat
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
```

The expected result is:

- typecheck: no errors;
- lint: no errors or warnings;
- Vitest: **9 files, 40 tests passed**;
- Next.js production build: success;
- Playwright: **2 tests passed** (`smoke.spec.ts` and `html-export.spec.ts`).

If a later change alters counts, update this document and the README rather than leaving stale numbers.
