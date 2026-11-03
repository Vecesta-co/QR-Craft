import { Buffer } from "node:buffer";
import { beforeAll, describe, expect, it } from "vitest";
import { BLOCKS } from "@/lib/blocks/registry";
import { writeStandaloneHtml, type StandaloneHtmlMetadata } from "@/lib/export/html";
import { createQrMatrix } from "@/lib/qr/matrix";
import { VoxelWorld } from "@/lib/world/VoxelWorld";
import { generateWorld, type GenerationResult } from "@/lib/world/generate";

const qr = createQrMatrix("https://example.com/qrcraft", {
  errorCorrectionLevel: "M",
  quietZone: 4,
});

const generatedAt = "2026-11-01T00:00:00.000Z";

interface EmbeddedData {
  version: number;
  meta: {
    title: string;
    payload: string;
    seed: number;
    site: string;
    style: string;
    quality: string;
    summary: string;
    size: number;
    height: number;
    moduleCount: number;
    cellSize: number;
    buildings: number;
    structures: number;
    blockCount: number;
    materialCount: number;
    generatedAt: string;
  };
  world: {
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    focus: number[];
    span: number;
  };
  atlas: { cols: number; rows: number; width: number; height: number; data: string };
  palette: Array<{
    id: string;
    name: string;
    transparent: boolean;
    alpha: number;
    emissive: number;
  }>;
  groups: Array<{ palette: number; count: number; data: string }>;
}

function embeddedData(html: string): EmbeddedData {
  const marker = "var DATA = ";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("The exported HTML has no embedded DATA payload.");
  const end = html.indexOf(";\n  var canvas =", start);
  if (end < 0) throw new Error("The embedded DATA payload has no terminator.");
  return JSON.parse(html.slice(start + marker.length, end)) as EmbeddedData;
}

let result: GenerationResult;
let html: string;

function metadata(overrides: Partial<StandaloneHtmlMetadata> = {}): StandaloneHtmlMetadata {
  return {
    payload: qr.payload,
    seed: 1337,
    siteLabel: result.brief.siteLabel,
    styleLabel: result.brief.styleLabel,
    qualityLabel: result.brief.qualityLabel,
    summary: result.brief.summary,
    moduleCount: qr.moduleCount,
    cellSize: result.layout.cellSize,
    buildings: result.stats.buildings,
    structures: result.stats.structures,
    generatedAt,
    ...overrides,
  };
}

describe("standalone HTML export", () => {
  beforeAll(() => {
    result = generateWorld({
      qr,
      seed: 1337,
      size: 128,
      site: "hamlet",
      style: "gothic",
      quality: "detailed",
      complexity: "balanced",
    });
    html = writeStandaloneHtml(result.finalWorld, metadata());
  }, 120_000);

  it("embeds the exposed shell, palette, atlas and metadata", () => {
    const data = embeddedData(html);
    expect(data.version).toBe(1);
    expect(data.meta.title).toBe(`${result.brief.siteLabel} · ${result.brief.styleLabel}`);
    expect(data.meta.payload).toBe(qr.payload);
    expect(data.meta.seed).toBe(1337);
    expect(data.meta.site).toBe(result.brief.siteLabel);
    expect(data.meta.style).toBe(result.brief.styleLabel);
    expect(data.meta.quality).toBe(result.brief.qualityLabel);
    expect(data.meta.summary).toBe(result.brief.summary);
    expect(data.meta.size).toBe(result.finalWorld.sizeX);
    expect(data.meta.height).toBe(result.finalWorld.sizeY);
    expect(data.meta.moduleCount).toBe(qr.moduleCount);
    expect(data.meta.cellSize).toBe(result.layout.cellSize);
    expect(data.meta.buildings).toBe(result.stats.buildings);
    expect(data.meta.structures).toBe(result.stats.structures);
    expect(data.meta.blockCount).toBe(result.stats.visibleBlocks);
    expect(data.meta.materialCount).toBe(data.palette.length);
    expect(data.meta.generatedAt).toBe(generatedAt);

    expect(data.world.sizeX).toBe(result.finalWorld.sizeX);
    expect(data.world.sizeY).toBe(result.finalWorld.sizeY);
    expect(data.world.sizeZ).toBe(result.finalWorld.sizeZ);
    expect(data.world.span).toBe(Math.max(data.world.sizeX, data.world.sizeZ, 96));
    expect(data.world.focus).toHaveLength(3);

    expect(data.palette.length).toBeGreaterThan(10);
    expect(data.palette.length).toBeLessThanOrEqual(65_535);
    expect(new Set(data.palette.map((entry) => entry.id)).size).toBe(data.palette.length);
    for (const entry of data.palette) {
      expect(BLOCKS[entry.id], `palette block ${entry.id}`).toBeDefined();
      expect(entry.name.length, `palette name ${entry.id}`).toBeGreaterThan(0);
      expect(entry.alpha).toBeGreaterThan(0);
      expect(entry.alpha).toBeLessThanOrEqual(1);
    }

    expect(data.groups.length).toBe(data.palette.length);
    const covered = new Set(data.groups.map((group) => group.palette));
    for (let index = 0; index < data.palette.length; index++) {
      expect(covered.has(index), `palette entry ${index} has block data`).toBe(true);
    }

    let blockCount = 0;
    for (const group of data.groups) {
      const bytes = Buffer.from(group.data, "base64");
      expect(bytes.length).toBe(group.count * 6);
      blockCount += group.count;
      for (let index = 0; index < group.count; index++) {
        const offset = index * 6;
        expect(bytes.readUInt16LE(offset)).toBeLessThan(data.world.sizeX);
        expect(bytes.readUInt16LE(offset + 2)).toBeLessThan(data.world.sizeY);
        expect(bytes.readUInt16LE(offset + 4)).toBeLessThan(data.world.sizeZ);
      }
    }
    expect(blockCount).toBe(data.meta.blockCount);

    expect(data.atlas.cols).toBeGreaterThanOrEqual(1);
    expect(data.atlas.cols).toBeLessThanOrEqual(16);
    expect(data.atlas.rows).toBe(Math.ceil(data.palette.length / data.atlas.cols));
    expect(data.atlas.width).toBe(data.atlas.cols * 16);
    expect(data.atlas.height).toBe(data.atlas.rows * 16);
    expect(Buffer.from(data.atlas.data, "base64").length).toBe(
      data.atlas.width * data.atlas.height * 4,
    );
  });

  it("is one self-contained document with an offline CSP and no external references", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(Buffer.byteLength(html, "utf8")).toBeGreaterThan(150_000);
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'unsafe-inline'");
    expect(html).toContain("Offline · no external requests");
    expect(html).toContain("not affiliated with, endorsed by or approved by Mojang");

    expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(html).not.toMatch(/<link\b[^>]*\bhref\s*=\s*["']?(?:https?:)?\/\//i);
    expect(html).not.toMatch(/<(?:img|iframe|audio|video|source)\b/i);
    expect(html).not.toMatch(/<link\b[^>]*\brel\s*=\s*["']stylesheet["']/i);
    expect(html).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|importScripts)\s*\(/);
    expect(html).not.toMatch(/\bimport\s*\(/);
  });

  it("escapes payload, summary and title so data cannot break out of the script or markup", () => {
    const attack = 'https://example.com/?</script><script>alert("qr")</script>&"';
    const nasty = writeStandaloneHtml(
      result.finalWorld,
      metadata({
        payload: attack,
        summary: '<b>summary</b> & "quotes"',
        siteLabel: '<Kingdom & "Co">',
        styleLabel: "<Gothic>",
      }),
    );
    // Use boolean checks for the multi-megabyte document so a failure does not
    // dump the entire export into the test log.
    expect(nasty.includes("</script><script>alert")).toBe(false);
    expect(nasty.includes("\\u003c/script>\\u003cscript>alert")).toBe(true);
    expect(nasty.includes("&lt;Kingdom &amp; &quot;Co&quot;&gt;")).toBe(true);
    expect(nasty.includes("&lt;Gothic&gt;")).toBe(true);

    const data = embeddedData(nasty);
    expect(data.meta.payload).toBe(attack);
    expect(data.meta.summary).toBe('<b>summary</b> & "quotes"');
    expect(data.meta.site).toBe('<Kingdom & "Co">');
    expect(data.meta.style).toBe("<Gothic>");
    expect(data.meta.title).toBe('<Kingdom & "Co"> · <Gothic>');
  });

  it("is byte-for-byte deterministic for the same world and metadata", () => {
    const again = writeStandaloneHtml(result.finalWorld, metadata());
    expect(again).toBe(html);
  });

  it("refuses to export a world with no visible blocks", () => {
    const empty = new VoxelWorld(8, 8, 8);
    expect(() => writeStandaloneHtml(empty, metadata())).toThrow(/no visible blocks/i);
  });
});
