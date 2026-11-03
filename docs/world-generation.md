# World Generation

This document describes how QR Craft turns a QR matrix into a deterministic Minecraft-style world, which parts are guaranteed by the projection contract, and where the generator intentionally stops.

The pipeline is deterministic. The same payload, seed, site size, site, style, quality and complexity produce the same voxel world, the same task graph and the same exports.

---

## 1. From payload to layout

`generateWorld()` in `src/lib/world/generate.ts` receives an already-built `QRMatrix` from the main thread. It never re-encodes the payload.

The matrix uses error correction **M**, a **4-module quiet zone**, and the encoder's automatic version selection. `data` is row-major, top row first, `1 = dark`, `0 = light`. `size` includes the quiet zone; `moduleCount` does not.

`createSiteLayout()` then chooses the world:

- requested sizes are **128, 192, 256 or 320** blocks square;
- the smallest allowed cell is **3 blocks**, the largest **7**;
- a **36-block total side margin** is reserved for the esplanade, moat and landscape;
- `minimum = qr.size * 3 + 36`;
- the requested site is used if it is large enough, otherwise the next size up is selected and the UI reports the upgrade;
- `cellSize = clamp(floor((site - 36) / qr.size), 3, 7)`;
- a site definition may raise the minimum further when its dominant landmark needs the room.

If even the 320² site is too small, generation fails with a message that asks for a shorter payload; it does not produce a world with sub-3-block modules.

The default payload (`https://example.com/qrcraft`) produces a version 3 symbol: 29 modules bare, 37 with the quiet zone. On a 192² site that is **4 blocks per module**, a **148 × 148 city**, and **21,904 projected columns**.

### Site bands

From the city outward:

| Band | Width | Contents |
| --- | --- | --- |
| City | `qr.size * cellSize` | QR modules, landmarks, streets, market, houses |
| Esplanade | 6 blocks | Pale paving, processional approach, quiet-zone margin |
| Moat | 6 blocks | Water ditch, 2 blocks below the plateau |
| Landscape | whatever remains | Site features, trees, rocks, fields, hamlet, approach road |

Key heights are fixed in `src/lib/world/site.ts`:

| Surface | Y |
| --- | --- |
| Water surface | 16 |
| Plateau top | 19 |
| City ground | 20 |
| Bridge deck | 20 |
| World height | 84 |

The city is centred on the site and includes the quiet zone, so the quiet zone is real, light paving rather than cropped margin. The bridge crosses the **south** moat; the QR's top row is at the **north** (low Z), per the coordinate conventions in [architecture.md](architecture.md).

### Sites

There are **24 site ids**. The first four preserve V1 exactly:

| Site id | Label | Default |
| --- | --- | ---: |
| `hamlet` | Hamlet | 128 |
| `kingdom` | Kingdom | 192 |
| `grand-kingdom` | Grand Kingdom | 256 |
| `monumental` | Monumental | 320 |

The 20 V2 sites are:

| Site id | Label | Category |
| --- | --- | --- |
| `alpine-citadel` | Alpine Citadel | Medieval |
| `coastal-fortress` | Coastal Fortress | Coastal |
| `imperial-capital` | Imperial Capital | Monumental |
| `cathedral-city` | Cathedral City | Historical |
| `riverside-trade-town` | Riverside Trade Town | Medieval |
| `highland-monastery` | Highland Monastery | Historical |
| `dwarven-mountain-hold` | Dwarven Mountain Hold | Fantasy |
| `ancient-temple-valley` | Ancient Temple Valley | Historical |
| `enchanted-forest` | Enchanted Forest | Fantasy |
| `giant-tree-sanctuary` | Giant Tree Sanctuary | Natural |
| `mushroom-vale` | Mushroom Vale | Natural |
| `crystal-cavern-realm` | Crystal Cavern Realm | Fantasy |
| `snowbound-village` | Snowbound Village | Natural |
| `volcanic-fortress` | Volcanic Fortress | Fantasy |
| `pirate-harbor` | Pirate Harbor | Coastal |
| `desert-oasis-city` | Desert Oasis City | Natural |
| `garden-citadel` | Garden Citadel | Monumental |
| `steampunk-industrial-port` | Steampunk Industrial Port | Industrial |
| `jungle-temple-ruins` | Jungle Temple Ruins | Historical |
| `floating-sky-kingdom` | Floating Sky Kingdom | Fantasy |

Every site definition declares terrain relief, fluid, surface/subsurface/stone, beach and snow line where relevant, vegetation kind and density, decorations, outer landmarks, city composition weights, and excellent/good style compatibility. The legacy four use the original valley generator; the new sites use data-driven profiles, not per-site generator branches. Every V2 default layout reserves enough landscape for at least one outer landmark; the brief lists only the landmark kinds actually built.

---

## 2. Terrain

`src/lib/world/terrain.ts` builds the landscape before any city architecture. The legacy path remains:

1. **Heightmap** — `17 + floor(fbm2D(x / 42, z / 42, seed + 71, 3) * 6)`, capped at 19 near the plateau and moat.
2. **Landscape fill** — grass or sand at the surface, dirt/sandstone below, stone/deepslate deeper.
3. **Plateau** — a solid stone terrace with a pale esplanade, a crenellated parapet, four corner bastions, and a gate opening on the south bridge axis.
4. **Moat** — the ditch is dug to water level, filled with water at Y 16, and cleared above the waterline so it is open to the sky. Occasional sea lanterns sit under the surface. There is no separate river; the moat is the only water feature on the legacy sites.
5. **Bridge and road** — an 8-block stone bridge with railings and supports crosses the moat. The road continues south over embankments, with lamp posts and gate lamps.
6. **Fields** — if the east/west margin can fit a plot at least 7 × 5 blocks and it does not overlap the moat, one field is added at Serene complexity and up to two otherwise. Fields have gravel borders, wheat/hay rows and hay bales. On the 192² legacy site there is no room, so no fields exist and none are claimed.
7. **Hamlet** — two timber cottages, a well and a hay stack are added only if a real band of land exists beyond the moat. The 192² legacy site fails that test, so `hasHamlet` is false and the brief does not mention an outer hamlet.
8. **Vegetation** — seeded trees, rocks, bushes, and roadside lantern posts. A protection mask keeps them off the road, fields, hamlet and moat.

For the 20 V2 sites, the same terrain step consumes the site's profile:

- relief, water level/fluid, surface, subsurface, stone, beach and snow line;
- vegetation family and density (oak, spruce, birch, jungle, palm, mushroom, crystal, dead or none);
- decoration categories such as boulders, snowcaps, driftwood, lava channels, terraces, ruins or smokestacks;
- outer feature kinds such as `giant-tree`, `sky-islands`, `pirate-ship`, `lighthouse`, `harbor`, `mountain-gate`, `temple-ruins`, `monastery`, `volcano`, `crystal-cavern`, `giant-mushrooms`, `oasis`, `canals`, `smokestacks`, `terraces`, `ruins`, `stone-circle`, `waterfall`, `windmill` and `sky-bridges`.

`buildSiteFeatures()` in `src/lib/world/site-features.ts` places those features in the landscape band and reports their footprints and labels. V2 sites reserve a 12-block landscape band outside the moat; the layout lowers the module cell size or upgrades the site when needed so that band exists. At the payload limit where even 320² cannot hold both the QR cell minimum and the band, generation keeps the payload and the brief omits any outer feature without room. Feature writes are clipped to their reserved rectangle, and fields and the outer hamlet are skipped when they would overlap one. A feature is named in the brief only when it was actually built, using a kind-to-label map rather than the broader site description list.

Terrain columns outside the city are **neutral** for QR purposes. They are never counted as matching modules.

### Complexity

`serene`, `balanced` and `dense` change:

- the number of fields (1 vs 2);
- tree density (`size² / 800`, `/ 570`, `/ 420`);
- rock/bush count (60, 110, 180);
- building heights and the chance of an extra watchtower;
- manor eligibility (manors are skipped at `serene`).

They do **not** change the QR matrix or the projection contract.

### Quality

`standard`, `detailed` and `showcase` are separate from complexity. They control the construction/detail passes:

- **Standard** — core architecture, doors, windows, roofs and essential lighting.
- **Detailed** — adds façade framing, roof variation, entrance paths, planters, balconies and more lighting.
- **Showcase** — adds fine trims, extra roof systems, courtyard decoration, richer lighting and landmark detail.

Quality changes the plan, never the QR class of a city column. The three tiers are measured to produce strictly increasing total and visible block counts.

---

## 3. City composition

`buildCity()` in `src/lib/world/city.ts` works on a module mask:

- `FREE` — available for a plot or street;
- `LANDMARK` — finder footprints and the quiet zone;
- `ROAD`, `BUILDING`, `MARKET` — reserved uses.

The order is:

1. **Ground** — every city column receives a class-correct ground block from the style palette.
2. **Quiet zone** — the outer 4-module ring is reserved and remains light paving.
3. **Finder landmarks** — the three 7 × 7 finder patterns become site-labelled versions of:
   - the keep (top-left finder);
   - the east bastion (top-right finder);
   - the grand cathedral / hall (bottom-left finder).

   Their footprints are reserved, and their towers, walls, roofs and battlements still obey the module's dark/light class on every top surface. They are architecture, not painted QR flats.
4. **Streets** — a grid is cut through free modules at the site's road spacing, measured from the quiet zone.
5. **Market** — the free 4 × 4 plot closest to the city centre becomes a market square with stalls on alternating perimeter modules, a central monument, and class-correct plaza paving.
6. **Processional avenue** — a two-module-wide avenue runs from the south gate to the market.
7. **Buildings** — remaining free regions are filled with plots in shuffled priority order: manors (except Serene), townhouses, houses, and 1- or 2-module rowhouses. Doors are placed toward an adjacent road or market module.
8. **Approach** — the south esplanade is paved in light materials only, because it touches the quiet zone.
9. **Site features** — the site's `cityFeatures` and landmark scale influence the inner composition, while outer features are built in the landscape band.

Every placement is recorded through `PlacementRecorder` with its group and build phase. The recorder is the single source for both the world and the construction plan, so there is no divergence between what is generated and what the builder places.

### Style grammar

The 53 `StyleDefinition`s in `src/lib/blocks/styles*.ts` decide:

- roof type, pitch, eaves and ornament;
- wall type, banding, buttresses and pilasters;
- window type, width, spacing, shutters and bars;
- door type, height and frame;
- chimneys, dormers, balconies, banners, planters, columns, arches and weathering;
- wall height, tower bias and lighting density.

`src/lib/world/architecture.ts` turns that grammar into stairs, slabs, fences, walls, trapdoors, doors and lanterns with full 1.21.4 block states. The first three styles (`gothic`, `royal`, `rustic`) keep their V1 identity.

### Painting rules

`src/lib/world/paint.ts` is the enforcement point:

- `groundAt`, `roofAt`, `roofCapAt`, `wallTrimAt`, `accentAt` and battlement/canopy helpers resolve the column to a module and return only materials from that module's dark or light set.
- `wallAt`, `foundationAt` and other side-facing materials use the style's **structural palette**. They do not alternate by QR class.
- This works because the projector checks the **topmost non-air block** in each column. Vertical faces can be stable masonry; the roof, ground, parapet or battlement top carries the bit.
- `windowAt()` and `doorAt()` use side-facing blocks, never QR-relevant top surfaces. Windows and doors are framed architecture, not glowstone or solid wall stand-ins.
- `metal` ornaments are side-facing and exempt from the top-surface class rule, but must still be registered blocks.

A neutral or missing top block inside `cityRect` is a conflict. There are no exceptions.

---

## 4. Determinism

Determinism comes from explicit seed plumbing, not from global randomness:

- `createRng(seed)` / `fbm2D` / `hash3` in `src/lib/world/rng.ts`;
- independent derived seeds for terrain, site features, city and sub-features;
- stable iteration order over arrays and maps;
- no `Math.random()` in generation, construction, projection or export.

The UI's **randomize seed** button calls `Math.random()` to pick a new seed value. That is a user input, not generation. Given the resulting seed, the world is reproducible.

The generation worker receives the canonical matrix, seed, size, site, style, quality and complexity, and returns everything needed to reconstruct the exact world. The completed `finalWorld` itself is not transferred; the main thread rebuilds it from the terrain snapshot plus the build plan.

---

## 5. Truthful brief and statistics

`src/lib/world/director.ts` creates the brief only after measuring the finished world:

- **Structures** = buildings + landmarks + market stalls;
- **Buildings** = houses, manors, rowhouses and towers (towers counted separately as well);
- **Towers** = landmark towers plus watchtowers;
- **World blocks** = all solid voxels, including terrain and foundations;
- **Visible blocks** = exposed blocks used by the renderer and HTML shell;
- **Tallest** = measured top Y, with the tallest landmark named;
- **Districts** include Castle Ward, Cathedral Close, Bastion Yard and Market/Town Ward; outer districts and feature names are added only when the terrain actually produced them;
- the water feature is described by its real profile — moat, harbour, oasis, canals, lava channels or none — never as a generic river.

The score (`scoreScene`) is a deterministic heuristic used for display. It is not a certification and does not claim artistic quality beyond its stated components.

---

## 6. Validation gates

Generation is not considered successful just because it produced geometry. Before the result leaves the worker:

1. **Projection check** — every city column is mapped to its module and compared by class. `conflicts` must be 0, coverage must cover the city.
2. **Software optical decode** — the actual top projection is rasterized from the world and decoded with ZXing. The text must equal the payload exactly. See [qr-certification.md](qr-certification.md).
3. **Plan compilation** — placements are grouped and ordered into phases. A failure here would surface as a generation error rather than a silently incomplete build.

The `v2-regression` suite repeats gates 1–3 for all 24 sites, all 53 styles and all three quality tiers. If either optical check fails, the store receives `Certification failed` with the reason and the app does not show `QR VERIFIED`. Construction may still show the world for inspection, but it is never labelled as verified.

The live WebGL certification after construction is a separate, stronger optical check. It is described in [qr-certification.md](qr-certification.md).

---

## 7. Default output

For the acceptance configuration (payload `https://example.com/qrcraft`, seed 1337, 192², Kingdom, High Gothic, Detailed, Balanced):

| Measure | Value |
| --- | --- |
| QR version | 3 |
| Bare modules | 29 × 29 |
| Matrix incl. quiet zone | 37 × 37 |
| Cell size | 4 blocks |
| City | 148 × 148 |
| Projected columns | 21,904 |
| Structures | 119 |
| Buildings | 110 |
| Towers | 6 |
| Construction tasks | 528 |
| Builder placements | 90,868 |
| World blocks | 826,253 |
| Visible blocks | 133,935 |
| Tallest Y | 64 |

`World blocks` is larger than `Builder placements` because it counts every solid voxel in the terrain and foundations, not only placements. The two numbers answer different questions and are labelled accordingly.

Values vary with payload, seed, site, style, quality and complexity. The counts above are measurements from the tested default, not constants. For reference, the same acceptance world at 256² yields 558 tasks / 140,743 placements / 1,452,961 world blocks, and at 320² it yields 634 tasks / 278,539 placements / 2,331,974 world blocks.

### Quality progression

For `kingdom` / `royal` / seed 2024 / Dense:

| Quality | Tasks | Placements | World blocks | Visible blocks |
| --- | ---: | ---: | ---: | ---: |
| Standard | 529 | 87,521 | 825,377 | 133,093 |
| Detailed | 548 | 88,345 | 826,201 | 133,293 |
| Showcase | 548 | 89,545 | 827,401 | 134,251 |

All three decode correctly, and both total and visible blocks increase strictly.

---

## 8. Extension points

- **New style** — add a `StyleId` to `src/lib/blocks/styles.ts`, define the full `StyleDefinition` in the appropriate `styles-*.ts` category file, and add compatibility lists to sites where relevant. See [adding-a-theme.md](adding-a-theme.md).
- **New site** — add a `WorldSiteDefinition` to `catalog-west.ts` or `catalog-east.ts`, include its id in `SITE_ID_VALUES`, and provide terrain/landmark/city data. The registry asserts completeness at import time.
- **New building type** — add a builder in `src/lib/world/buildings.ts`, route it in `city.ts`, and give it group/phase labels in `plan.ts`.
- **New landmark** — add a builder in `landmarks.ts` or `site-features.ts` and reserve its footprint in the city/site mask. It must preserve the class of every top surface it occupies.
- **New terrain feature** — add it to `terrain.ts` or `site-features.ts` and export its footprint so the brief and protection masks stay truthful. Do not describe a feature that the generator may skip.

Any extension must keep the projection invariant and the honest-brief rule intact. Run `npm test` and `npm run test:smoke` after changes.
