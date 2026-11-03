# Adding a Style or Theme

QR Craft currently ships **53 architectural styles** inside one generator family. The first three — **High Gothic**, **Royal Marble** and **Rustic Timber** — are the preserved V1 identities. The rest add their own roof, wall, window, door, detail, proportion and lighting grammar.

This document explains how to add a style, how to add a new texture family, and what a genuinely new theme would require.

---

## 1. Style vs theme

| Concept | Current implementation | What changes |
| --- | --- | --- |
| **Generator family** | `WorldBrief.theme = "medieval"` | City composer, landmark vocabulary, brief assumptions |
| **Site** | 24 `WorldSiteDefinition`s | Terrain, water, vegetation, outer landmarks, composition weights |
| **Style** | 53 `StyleDefinition`s | Materials plus roof/wall/window/door/detail geometry |
| **Quality** | `standard`, `detailed`, `showcase` | Number and kind of construction/detail passes |

Adding a style is a supported, contained change. Adding a second generator family (for example a science-fiction city) is a feature project because the city composer, landmark builders, task labels and brief text assume the current vocabulary.

---

## 2. Add a style

### Step 1 — add the id

Append the id to `STYLE_IDS` in `src/lib/blocks/styles.ts` and to the appropriate category record:

```text
src/lib/blocks/styles-medieval.ts
src/lib/blocks/styles-classical.ts
src/lib/blocks/styles-asian.ts
src/lib/blocks/styles-regional.ts
src/lib/blocks/styles-fantasy.ts
```

`STYLE_IDS` is the canonical order used by the UI. The registry asserts at import time that the id list and the combined definition maps match exactly.

### Step 2 — provide a complete `StyleDefinition`

Use the helpers in `src/lib/blocks/style-helpers.ts` to keep definitions compact:

```ts
"coastal-limestone": defineStyle({
  id: "coastal-limestone",
  label: "Coastal Limestone",
  description: "Pale limestone, dark slate roofs and sea-glass accents.",
  category: "Regional",
  swatches: ["#46474e", "#e0e1dc", "#3f7f83"],
  palette: {
    dark: ms({ /* dark MaterialSet */ }),
    light: ms({ /* light MaterialSet */ }),
  },
  structure: structure(
    ["minecraft:stone_bricks", "minecraft:mossy_stone_bricks"],
    "minecraft:stone",
  ),
  roof: roof("gable", 0.7, true, "gables"),
  wall: wall("panelled", "stone", 0, false),
  window: windows("arched", 2, 2, true),
  door: doors("arched", 3, true),
  detail: detail({ planters: true, chimneys: true, weathering: 0.1 }),
  proportions: proportions(5, 0.7, 1.1),
  lighting: lighting("lantern", 0.8),
}),
```

Required material fields are:

```ts
interface MaterialSet {
  ground: readonly string[];
  foundation: string;
  wall: readonly string[];
  roof: readonly string[];
  roofEdge: string;
  trim: string;
  accent: string;
  window: string;
  door: string;
  /** Side-facing metal ornament; never used on a QR-relevant top surface. */
  metal?: string;
}
```

The structural palette may also provide class-specific wall/foundation families:

```ts
structure(
  ["minecraft:stone_bricks", "minecraft:mossy_stone_bricks"],
  "minecraft:stone",
  ["minecraft:deepslate_bricks"],      // optional dark wall
  ["minecraft:calcite"],               // optional light wall
  "minecraft:deepslate_bricks",        // optional dark foundation
  "minecraft:polished_diorite",        // optional light foundation
)
```

### Step 3 — respect the optical contract

The tests enforce hard limits:

- dark projection materials must have relative luminance **< 0.2**;
- light projection materials must have relative luminance **> 0.5**;
- every id must exist in Minecraft 1.21.4 data;
- every palette reference must be a registered block;
- every top-surface field (`ground`, `foundation`, `roof`, `roofEdge`, `trim`, `accent`) must match its dark/light class.

A style that picks mid-grey for both sides will fail, and it should: the QR would lose contrast. Do not weaken the thresholds to accommodate a palette. Choose genuinely dark and genuinely light materials.

Side walls, doors, windows and metal accents are not QR-relevant top surfaces. They may be warmer or more neutral without breaking the projection.

### Step 4 — use real geometry grammar

The style is more than a palette. Choose grammar values that visibly change the world:

- roof: `stepped`, `gable`, `hip`, `flat`, `dome`, `pagoda`, `spire`, `sawtooth`, `clerestory`, `ruined`;
- wall: `solid`, `buttressed`, `timber`, `arcade`, `rusticated`, `panelled`, `pilastered`, `overgrown`;
- window: `lancet`, `round`, `grid`, `slit`, `oriel`, `arched`, `rose`, `shoji`, `ruined`;
- door: `arched`, `double`, `gate`, `portcullis`, `round`, `timber`, `screen`;
- detail: chimneys, dormers, balconies, banners, planters, columns, arches, weathering;
- lighting: `lantern`, `torch`, `soul`, `glow`, `crystal`, `none`.

`src/lib/world/architecture.ts` turns these into real stairs, slabs, fences, walls, trapdoors, doors and lanterns with validated 1.21.4 states. No extra UI code is needed: `EncodePanel` maps over the canonical style order and reads the label, description and swatches.

### Step 5 — optional site compatibility

Site definitions list `excellentStyles` and `goodStyles`. Add the new id to relevant sites if it expresses that landscape especially well. Compatibility is a recommendation; it never blocks generation.

### Step 6 — verify

```bat
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
```

The `v2-regression` suite generates **all 53 styles** and checks:

- each style changes the world hash;
- zero projection conflicts and full QR coverage;
- the software top view decodes exactly;
- the palette is legal;
- every required semantic state family is emitted.

Then generate a world with the new style and:

- inspect Top-down for a crisp dark/light split;
- confirm verification reaches `QR VERIFIED` and `4 / 4` variants;
- inspect Showcase and the other views for architectural coherence;
- confirm roofs, ground and battlements use the expected palette;
- confirm walls, windows and doors use the structural/side-facing materials.

---

## 3. Add texture variety

If a new material needs a different surface pattern rather than another colour:

1. Add a member to the `TextureKind` union in `src/lib/blocks/registry.ts`.
2. Add a branch in `patternFactor()` in `src/lib/render/textures.ts`.
3. Keep it 16 × 16 and deterministic from the block id seed.
4. Check it at both close range and top-down distance: strong high-frequency noise can hurt the optical decode.
5. Run the block, generation and smoke tests.

Because `buildTexturePixels()` is pure, the same pattern automatically appears in the standalone HTML atlas. Textures must remain original procedural output. Do not import Minecraft textures or recolour extracted assets.

---

## 4. Add a genuinely new theme

This remains a larger change. At minimum:

1. Change `WorldBrief.theme` from the literal `"medieval"` to a union and add a theme field to `WorldConfig`.
2. Thread the theme through the worker request, store, layout and generation.
3. Implement a new city composer or parameterize `buildCity()`:
   - landmark set and footprints;
   - road/market logic;
   - building types and task group labels.
4. Update `createWorldBrief()` so labels, district names and descriptions describe what was actually built.
5. Add theme-specific tests for composition and projection.
6. Update the README, docs and UI copy. Do not leave “Medieval Kingdom” text on a different theme.

A second theme must still satisfy the same invariants:

- finder patterns map to real architecture;
- every city top surface carries its module's dark/light class;
- the projection check reports zero conflicts;
- a real rendered top view decodes to the exact payload;
- features are named only when they exist.

---

## 5. Checklist

- [ ] `STYLE_IDS` updated and the style added to a category file.
- [ ] Dark and light `MaterialSet`s complete.
- [ ] Structural palette complete.
- [ ] Roof/wall/window/door/detail/proportion/lighting grammar chosen.
- [ ] All block ids registered and real.
- [ ] Dark luminance < 0.2; light luminance > 0.5.
- [ ] Top-surface fields match their projection class.
- [ ] Optional site compatibility updated.
- [ ] Typecheck, lint, unit tests and build pass.
- [ ] Both Playwright specs pass.
- [ ] Manual top-down decode and robustness pass for the new style.
- [ ] README style/site counts updated if the public list changed.
