import minecraftData from "minecraft-data";
import { describe, expect, it } from "vitest";
import { BLOCKS, STYLES, relativeLuminance } from "@/lib/blocks/registry";

const data = minecraftData("1.21.4");

describe("curated block registry", () => {
  it("only uses block ids that exist in Minecraft 1.21.4 data", () => {
    const missing: string[] = [];
    for (const id of Object.keys(BLOCKS)) {
      const name = id.replace(/^minecraft:/, "");
      if (!data.blocksByName[name]) missing.push(id);
    }
    expect(missing).toEqual([]);
  });

  it("keeps QR dark and light materials visually separated", () => {
    const dark = Object.values(BLOCKS)
      .filter((block) => block.projection === "dark")
      .map((block) => relativeLuminance(block.color));
    const light = Object.values(BLOCKS)
      .filter((block) => block.projection === "light")
      .map((block) => relativeLuminance(block.color));
    expect(dark.length).toBeGreaterThan(0);
    expect(light.length).toBeGreaterThan(0);
    expect(Math.max(...dark)).toBeLessThan(0.2);
    expect(Math.min(...light)).toBeGreaterThan(0.5);
  });

  it("only references registered blocks from every style palette", () => {
    const referenced = new Set<string>();
    for (const style of Object.values(STYLES)) {
      for (const set of [style.palette.dark, style.palette.light]) {
        for (const id of [
          ...set.ground,
          set.foundation,
          ...set.wall,
          ...set.roof,
          set.roofEdge,
          set.trim,
          set.accent,
          set.window,
          set.door,
        ]) {
          referenced.add(id);
        }
      }
      referenced.add(style.structure.foundation);
      for (const id of style.structure.wall) referenced.add(id);
    }
    const unknown = [...referenced].filter((id) => !BLOCKS[id]);
    expect(unknown).toEqual([]);
  });
});
