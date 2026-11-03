import minecraftData from "minecraft-data";
import { describe, expect, it } from "vitest";
import { BLOCKS, STYLES } from "@/lib/blocks/registry";
import {
  STYLE_CATEGORIES,
  STYLE_IDS,
  assertStyleRegistryComplete,
} from "@/lib/blocks/styles";
import { QUALITY_LEVELS, type QualityLevel } from "@/lib/blocks/style-types";
import { parseBlockState } from "@/lib/blocks/state";
import { createQrMatrix } from "@/lib/qr/matrix";
import { SITE_ID_VALUES, type SiteId } from "@/lib/sites/types";
import { SITE_ORDER, SITES, assertSiteRegistryComplete } from "@/lib/sites/registry";
import { generateWorld } from "@/lib/world/generate";
import type { GenerationResult } from "@/lib/world/generate";
import { SITE_SIZES } from "@/lib/world/site";

const data = minecraftData("1.21.4");
const qr = createQrMatrix("https://example.com/qrcraft", {
  errorCorrectionLevel: "M",
  quietZone: 4,
});

const LEGACY_SITES = ["hamlet", "kingdom", "grand-kingdom", "monumental"] as const;
const REQUIRED_STATE_FAMILIES = [
  "door",
  "stairs",
  "slab",
  "fence",
  "wall",
  "trapdoor",
  "lantern",
] as const;

/** Validates a full block-state string against the Minecraft 1.21.4 data. */
function stateIssues(state: string): string[] {
  const issues: string[] = [];
  let parsed: ReturnType<typeof parseBlockState>;
  try {
    parsed = parseBlockState(state);
  } catch (error) {
    return [`unparseable state ${state}: ${error instanceof Error ? error.message : error}`];
  }
  const name = parsed.base.startsWith("minecraft:") ? parsed.base.slice("minecraft:".length) : parsed.base;
  const block = data.blocksByName[name];
  if (!block) return [`unknown block ${parsed.base}`];
  const properties = new Map((block.states ?? []).map((entry) => [entry.name, entry]));
  for (const [key, value] of Object.entries(parsed.props)) {
    const property = properties.get(key);
    if (!property) {
      issues.push(`${parsed.base} has no property ${key}`);
      continue;
    }
    if (property.type === "bool") {
      if (value !== "true" && value !== "false") {
        issues.push(`${parsed.base}.${key} is a boolean, got ${value}`);
      }
    } else if (property.type === "enum" || property.type === "direction") {
      const allowed = (property.values ?? []).map(String);
      if (!allowed.includes(value)) {
        issues.push(`${parsed.base}.${key} does not allow ${value}`);
      }
    } else if (property.type === "int") {
      if (!/^-?\d+$/.test(value)) {
        issues.push(`${parsed.base}.${key} is an integer, got ${value}`);
      }
    }
  }
  return issues;
}

function paletteIssues(result: GenerationResult): string[] {
  const issues: string[] = [];
  for (const id of result.finalWorld.palette) {
    if (id === "minecraft:air") continue;
    issues.push(...stateIssues(id));
  }
  return issues;
}

function stateFamily(base: string): string {
  if (base.endsWith("_stairs")) return "stairs";
  if (base.endsWith("_slab")) return "slab";
  if (base.endsWith("_fence")) return "fence";
  if (base.endsWith("_wall")) return "wall";
  if (base.endsWith("_trapdoor")) return "trapdoor";
  if (base.endsWith("_door")) return "door";
  if (base.endsWith("lantern")) return "lantern";
  if (base.endsWith("_bars")) return "bars";
  if (base.endsWith("_chain")) return "chain";
  return "other";
}

function checkResult(label: string, result: GenerationResult): void {
  expect(result.projection.conflicts, `${label} projection conflicts`).toBe(0);
  expect(result.projection.matrixMatched, `${label} matrix match`).toBe(true);
  expect(result.projection.coverage, `${label} projection coverage`).toBe(1);
  expect(result.softwareDecode.decoded, `${label} rendered decode`).toBe(true);
  expect(result.softwareDecode.text, `${label} decoded payload`).toBe(qr.payload);
  expect(result.softwareDecode.payloadMatched, `${label} payload match`).toBe(true);
  expect(result.stats.buildings, `${label} buildings`).toBeGreaterThan(0);
  expect(result.stats.structures, `${label} structures`).toBeGreaterThan(0);
  expect(result.stats.totalBlocks, `${label} total blocks`).toBeGreaterThan(5_000);
  expect(result.plan.tasks.length, `${label} build tasks`).toBeGreaterThan(0);
  expect(paletteIssues(result), `${label} block states`).toEqual([]);
}

describe("V2 registries", () => {
  it("exposes exactly 53 complete, unique styles", () => {
    expect(STYLE_IDS).toHaveLength(53);
    expect(new Set(STYLE_IDS).size).toBe(STYLE_IDS.length);
    expect(() => assertStyleRegistryComplete()).not.toThrow();
    expect(Object.keys(STYLES).sort()).toEqual([...STYLE_IDS].sort());

    for (const id of STYLE_IDS) {
      const style = STYLES[id];
      expect(style.id, `${id} id`).toBe(id);
      expect(style.label.length, `${id} label`).toBeGreaterThan(1);
      expect(style.description.length, `${id} description`).toBeGreaterThan(20);
      expect(STYLE_CATEGORIES).toContain(style.category as (typeof STYLE_CATEGORIES)[number]);
      expect(style.version, `${id} version`).toBeGreaterThanOrEqual(2);
      expect(style.swatches, `${id} swatches`).toHaveLength(3);
      for (const swatch of style.swatches) {
        expect(swatch, `${id} swatch ${swatch}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
      for (const className of ["dark", "light"] as const) {
        const set = style.palette[className];
        expect(set.ground.length, `${id} ${className} ground`).toBeGreaterThan(0);
        expect(set.wall.length, `${id} ${className} wall`).toBeGreaterThan(0);
        expect(set.roof.length, `${id} ${className} roof`).toBeGreaterThan(0);
        for (const block of [
          set.foundation,
          ...set.ground,
          ...set.wall,
          ...set.roof,
          set.roofEdge,
          set.trim,
          set.accent,
          set.window,
          set.door,
          ...(set.metal ? [set.metal] : []),
        ]) {
          expect(BLOCKS[block], `${id} ${className} material ${block}`).toBeDefined();
        }
      }
    }
  });

  it("exposes exactly 24 complete, unique sites with the four V1 presets first", () => {
    expect(SITE_ID_VALUES).toHaveLength(24);
    expect(SITE_ORDER).toEqual(SITE_ID_VALUES);
    expect(new Set(SITE_ORDER).size).toBe(SITE_ORDER.length);
    expect(() => assertSiteRegistryComplete()).not.toThrow();
    expect(Object.keys(SITES).sort()).toEqual([...SITE_ID_VALUES].sort());

    for (const id of SITE_ID_VALUES) {
      const site = SITES[id];
      expect(site.id, `${id} id`).toBe(id);
      expect(site.name.length, `${id} name`).toBeGreaterThan(1);
      expect(site.description.length, `${id} description`).toBeGreaterThan(30);
      expect(site.shortDescription.length, `${id} short description`).toBeGreaterThan(10);
      expect(SITE_SIZES, `${id} default size`).toContain(site.defaultSize);
      expect(SITE_SIZES, `${id} minimum size`).toContain(site.minimumSize);
      expect(site.minimumSize, `${id} minimum <= default`).toBeLessThanOrEqual(site.defaultSize);
      expect(site.recommendedSizes, `${id} recommended sizes`).toContain(site.defaultSize);
      expect(site.primaryLandmarks.length, `${id} primary landmarks`).toBeGreaterThan(0);
      expect(site.excellentStyles.length, `${id} excellent styles`).toBeGreaterThan(0);
      for (const style of [...site.excellentStyles, ...site.goodStyles]) {
        expect(STYLE_IDS, `${id} style ${style}`).toContain(style);
      }
    }

    expect(SITE_ORDER.slice(0, 4)).toEqual([...LEGACY_SITES]);
    for (const id of LEGACY_SITES) {
      expect(SITES[id].legacy, `${id} legacy flag`).toBe(true);
    }
    for (const id of SITE_ORDER.slice(4)) {
      expect(SITES[id].legacy, `${id} legacy flag`).toBe(false);
    }
  });
});

describe("V2 world matrix", () => {
  it(
    "keeps the QR intact and the palette legal for every site",
    () => {
      const rows = SITE_ID_VALUES.map((site: SiteId) => {
        const result = generateWorld({
          qr,
          seed: 1337,
          size: 128,
          site,
          style: "gothic",
          quality: "detailed",
          complexity: "balanced",
        });
        checkResult(`site:${site}`, result);
        expect(result.brief.site, `site:${site} brief`).toBe(site);
        expect(result.config.site, `site:${site} config`).toBe(site);
        return { label: site, hash: result.finalWorld.contentHash() };
      });

      // The four V1 presets deliberately share the original valley generator.
      // Every new site must produce a physically different world.
      const legacyHashes = new Set(
        rows.filter((row) => (LEGACY_SITES as readonly string[]).includes(row.label)).map((row) => row.hash),
      );
      const newRows = rows.filter((row) => !(LEGACY_SITES as readonly string[]).includes(row.label));
      expect(newRows).toHaveLength(20);
      expect(new Set(newRows.map((row) => row.hash)).size, "new site worlds are distinct").toBe(20);
      for (const row of newRows) {
        expect(legacyHashes.has(row.hash), `${row.label} differs from the legacy valley`).toBe(false);
      }
    },
    300_000,
  );

  it(
    "keeps the QR intact for every style and emits every semantic state family",
    () => {
      const hashes = new Set<string>();
      const families = new Set<string>();
      for (const style of STYLE_IDS) {
        const result = generateWorld({
          qr,
          seed: 1337,
          size: 128,
          site: "hamlet",
          style,
          quality: "showcase",
          complexity: "balanced",
        });
        checkResult(`style:${style}`, result);
        expect(result.brief.style, `style:${style} brief`).toBe(style);
        hashes.add(result.finalWorld.contentHash());
        for (const id of result.finalWorld.palette) {
          if (!id.includes("[")) continue;
          families.add(stateFamily(parseBlockState(id).base));
        }
      }
      expect(hashes.size, "each style changes the world").toBe(STYLE_IDS.length);
      for (const family of REQUIRED_STATE_FAMILIES) {
        expect(families.has(family), `semantic state family ${family} is used`).toBe(true);
      }
    },
    300_000,
  );

  it(
    "makes standard, detailed and showcase real, increasing construction passes",
    () => {
      const qualities: QualityLevel[] = [...QUALITY_LEVELS];
      const results = qualities.map((quality) => {
        const result = generateWorld({
          qr,
          seed: 2024,
          size: 192,
          site: "kingdom",
          style: "royal",
          quality,
          complexity: "dense",
        });
        checkResult(`quality:${quality}`, result);
        expect(result.brief.quality, `quality:${quality} brief`).toBe(quality);
        expect(result.config.quality, `quality:${quality} config`).toBe(quality);
        return result;
      });

      expect(new Set(results.map((result) => result.finalWorld.contentHash())).size).toBe(3);
      expect(results[1].stats.totalBlocks).toBeGreaterThan(results[0].stats.totalBlocks);
      expect(results[2].stats.totalBlocks).toBeGreaterThan(results[1].stats.totalBlocks);
      expect(results[1].stats.visibleBlocks).toBeGreaterThan(results[0].stats.visibleBlocks);
      expect(results[2].stats.visibleBlocks).toBeGreaterThan(results[1].stats.visibleBlocks);
    },
    300_000,
  );

  it("is deterministic for an identical configuration", () => {
    const options = {
      qr,
      seed: 8080,
      size: 192 as const,
      site: "alpine-citadel" as const,
      style: "alpine-chalet" as const,
      quality: "showcase" as const,
      complexity: "balanced" as const,
    };
    const first = generateWorld(options);
    const second = generateWorld(options);
    expect(second.finalWorld.contentHash()).toBe(first.finalWorld.contentHash());
    expect(second.finalWorld.palette).toEqual(first.finalWorld.palette);
    expect(second.stats).toEqual(first.stats);
    expect(second.plan.totalBlocks).toBe(first.plan.totalBlocks);
    expect(second.softwareDecode.text).toBe(first.softwareDecode.text);
  }, 120_000);
});
