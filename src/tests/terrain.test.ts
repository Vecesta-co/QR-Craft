import { describe, expect, it } from "vitest";
import { createQrMatrix } from "@/lib/qr/matrix";
import { FEATURE_LANDSCAPE_BAND, createSiteLayout, insideRect, type Rect } from "@/lib/world/site";
import { generateTerrain } from "@/lib/world/terrain";
import { buildSiteFeatures, planSiteFeatures, siteFeatureLabel } from "@/lib/world/site-features";
import { SITE_ORDER, siteFor, siteLandscapeBand } from "@/lib/sites/registry";
import { VoxelWorld } from "@/lib/world/VoxelWorld";

const qr = createQrMatrix("https://example.com/qrcraft", {
  errorCorrectionLevel: "M",
  quietZone: 4,
});

function terrainFor(site: 192 | 256) {
  const layout = createSiteLayout(qr, site);
  return { layout, terrain: generateTerrain(layout, 1337, "balanced") };
}

describe("terrain water features", () => {
  it("keeps the moat open to the sky instead of burying it under the landscape", () => {
    const { layout, terrain } = terrainFor(192);
    const samples: Array<[number, number]> = [
      [layout.moatRect.x1 + 2, layout.centerZ],
      [layout.moatRect.x2 - 2, layout.centerZ],
      [layout.centerX, layout.moatRect.z1 + 2],
    ];
    for (const [x, z] of samples) {
      const top = terrain.world.topBlock(x, z);
      if (top?.y === layout.waterY + 1) {
        expect(top.id).toBe("minecraft:sea_lantern");
      } else {
        expect(top?.y).toBe(layout.waterY);
        expect(top?.id).toBe("minecraft:water");
      }
      expect(terrain.world.get(x, layout.waterY + 2, z)).toBe("minecraft:air");
    }
  });

  it("spans the moat with a solid bridge deck at the south gate", () => {
    const { layout, terrain } = terrainFor(192);
    const top = terrain.world.topBlock(layout.centerX, layout.moatRect.z2 - 1);
    expect(top?.y).toBe(layout.bridgeY);
    expect(top?.id).toBe("minecraft:stone");
  });

  it("does not claim fields or an outer hamlet on a tightly packed 192 site", () => {
    const { terrain } = terrainFor(192);
    expect(terrain.fieldRects).toHaveLength(0);
    expect(terrain.hasHamlet).toBe(false);
  });

  it("adds crop fields and an outer hamlet when the 256 site has room for them", () => {
    const { layout, terrain } = terrainFor(256);
    expect(terrain.fieldRects.length).toBeGreaterThan(0);
    expect(terrain.hasHamlet).toBe(true);
    for (const field of terrain.fieldRects) {
      const overlapsMoat =
        field.x1 <= layout.moatRect.x2 &&
        field.x2 >= layout.moatRect.x1 &&
        field.z1 <= layout.moatRect.z2 &&
        field.z2 >= layout.moatRect.z1;
      expect(overlapsMoat).toBe(false);
      expect(field.x1).toBeGreaterThanOrEqual(4);
      expect(field.z2).toBeLessThanOrEqual(layout.worldSize - 6);
    }
  });
});

function overlaps(a: Rect, b: Rect): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.z1 <= b.z2 && a.z2 >= b.z1;
}

describe("V2 outer landmark space", () => {
  it("reserves a landscape band and keeps every V2 default site supplied with named features", () => {
    for (const id of SITE_ORDER.slice(4)) {
      const site = siteFor(id);
      const layout = createSiteLayout(
        qr,
        site.defaultSize,
        site.minimumSize,
        siteLandscapeBand(id),
      );
      expect(layout.moatRect.x1 - 2, `${id} west landscape band`).toBeGreaterThanOrEqual(
        FEATURE_LANDSCAPE_BAND,
      );
      const plan = planSiteFeatures(layout, site);
      expect(plan.length, `${id} planned features`).toBeGreaterThan(0);
      for (const feature of plan) {
        expect(overlaps(feature.rect, layout.moatRect), `${id} feature overlaps moat`).toBe(false);
      }
      const terrain = generateTerrain(layout, 1337, "balanced", site);
      expect(terrain.features, `${id} built feature names`).toEqual(
        plan.map((entry) => siteFeatureLabel(entry.kind)),
      );
      for (const field of terrain.fieldRects) {
        for (const feature of plan) {
          expect(overlaps(field, feature.rect), `${id} field overlaps feature`).toBe(false);
        }
      }
    }
  });

  it("clips every feature write to its reserved landscape rectangle", () => {
    class RecordingWorld extends VoxelWorld {
      readonly writes: Array<{ x: number; z: number }> = [];

      override set(x: number, y: number, z: number, id: string): void {
        this.writes.push({ x, z });
        super.set(x, y, z, id);
      }
    }

    for (const id of [
      "dwarven-mountain-hold",
      "giant-tree-sanctuary",
      "desert-oasis-city",
    ] as const) {
      const site = siteFor(id);
      const layout = createSiteLayout(
        qr,
        site.defaultSize,
        site.minimumSize,
        siteLandscapeBand(id),
      );
      const base = generateTerrain(layout, 1337, "balanced");
      const recording = new RecordingWorld(layout.worldSize, layout.worldHeight, layout.worldSize);
      const result = buildSiteFeatures(recording, layout, site, base.heights, 1337);
      expect(recording.writes.length, `${id} wrote feature blocks`).toBeGreaterThan(0);
      for (const write of recording.writes) {
        expect(
          result.rects.some((rect) => insideRect(write.x, write.z, rect)),
          `${id} wrote at ${write.x},${write.z} outside its feature rectangles`,
        ).toBe(true);
      }
    }
  });
});
