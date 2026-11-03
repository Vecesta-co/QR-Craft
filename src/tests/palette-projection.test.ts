import { describe, expect, it } from "vitest";
import { BLOCKS, STYLES } from "@/lib/blocks/registry";

/**
 * QR projection is decided by the topmost block of each world column. These
 * material fields are used on top surfaces, so they must carry the same
 * projection class as the QR module they build. Side-facing fields such as
 * `window`, `door` and `metal` are intentionally not included.
 */
const TOP_SURFACE_FIELDS = [
  "ground",
  "foundation",
  "roof",
  "roofEdge",
  "trim",
  "accent",
] as const;

function blocks(value: string | readonly string[]): string[] {
  return typeof value === "string" ? [value] : [...value];
}

describe("style palette QR projection", () => {
  it("keeps every top-surface material in the correct dark or light class", () => {
    const issues: string[] = [];
    for (const [styleId, style] of Object.entries(STYLES)) {
      for (const className of ["dark", "light"] as const) {
        const set = style.palette[className];
        for (const field of TOP_SURFACE_FIELDS) {
          const values = blocks(set[field]);
          if (values.length === 0) {
            issues.push(`${styleId}.${className}.${field} is empty`);
          }
          for (const block of values) {
            const definition = BLOCKS[block];
            if (!definition) {
              issues.push(`${styleId}.${className}.${field} uses unknown block ${block}`);
            } else if (definition.projection !== className) {
              issues.push(
                `${styleId}.${className}.${field} uses ${block} (${definition.projection})`,
              );
            }
          }
        }
      }
    }
    expect(issues).toEqual([]);
  });

  it("keeps side-facing metal ornaments registered but out of the QR class rule", () => {
    for (const [styleId, style] of Object.entries(STYLES)) {
      for (const className of ["dark", "light"] as const) {
        const metal = style.palette[className].metal;
        if (!metal) continue;
        expect(BLOCKS[metal], `${styleId}.${className}.metal ${metal}`).toBeDefined();
      }
    }
  });
});
