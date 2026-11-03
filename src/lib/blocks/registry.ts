import { baseBlockId } from "@/lib/blocks/state";
import type { ProjectionClass } from "@/lib/blocks/style-types";

export type {
  DoorGrammar,
  DoorType,
  DetailGrammar,
  LightingGrammar,
  LightingKind,
  MaterialSet,
  OrnamentType,
  ProjectionClass,
  QualityLevel,
  RoofGrammar,
  RoofType,
  StructuralPalette,
  StyleDefinition,
  StyleProportions,
  ThemePalette,
  WallGrammar,
  WallType,
  WindowGrammar,
  WindowType,
} from "@/lib/blocks/style-types";
export {
  QUALITY_COPY,
  QUALITY_LABELS,
  QUALITY_LEVELS,
} from "@/lib/blocks/style-types";

export type TextureKind =
  | "stone"
  | "stoneBrick"
  | "cobble"
  | "tile"
  | "planks"
  | "log"
  | "leaves"
  | "grass"
  | "dirt"
  | "concrete"
  | "mineral"
  | "water"
  | "fabric"
  | "glow"
  | "metal"
  | "gravel"
  | "snow"
  | "thatch"
  | "sand"
  | "glass"
  | "bars"
  | "flower"
  | "crystal"
  | "lava";

export interface BlockDefinition {
  id: string;
  displayName: string;
  projection: ProjectionClass;
  /** Representative top-face colour. Also used by the offscreen QR render. */
  color: string;
  texture: TextureKind;
  solid: boolean;
  transparent?: boolean;
  emissive?: number;
}

const B = (
  id: string,
  displayName: string,
  projection: ProjectionClass,
  color: string,
  texture: TextureKind,
  options: Partial<Pick<BlockDefinition, "solid" | "transparent" | "emissive">> = {},
): BlockDefinition => ({
  id: `minecraft:${id}`,
  displayName,
  projection,
  color,
  texture,
  solid: options.solid ?? true,
  transparent: options.transparent,
  emissive: options.emissive,
});

export const BLOCKS: Record<string, BlockDefinition> = Object.fromEntries(
  [
    // Dark QR materials
    B("deepslate_tiles", "Deepslate Tiles", "dark", "#37383e", "tile"),
    B("deepslate_bricks", "Deepslate Bricks", "dark", "#46474e", "stoneBrick"),
    B("polished_blackstone_bricks", "Polished Blackstone Bricks", "dark", "#353039", "stoneBrick"),
    B("blackstone", "Blackstone", "dark", "#2c272c", "stone"),
    B("black_concrete", "Black Concrete", "dark", "#1b1b1f", "concrete"),
    B("dark_oak_planks", "Dark Oak Planks", "dark", "#3e2a17", "planks"),
    B("dark_oak_log", "Dark Oak Log", "dark", "#2f2115", "log"),
    B("deepslate", "Deepslate", "dark", "#4a4b50", "stone"),
    B("cobbled_deepslate", "Cobbled Deepslate", "dark", "#3b3c41", "cobble"),
    B("polished_deepslate", "Polished Deepslate", "dark", "#34343a", "stone"),
    B("nether_bricks", "Nether Bricks", "dark", "#2e181d", "stoneBrick"),
    B("black_wool", "Black Wool", "dark", "#222226", "fabric"),

    // Light QR materials
    B("calcite", "Calcite", "light", "#e0e1dc", "mineral"),
    B("quartz_block", "Quartz Block", "light", "#e8e5df", "mineral"),
    B("smooth_quartz", "Smooth Quartz", "light", "#eae7e1", "mineral"),
    B("white_concrete", "White Concrete", "light", "#cfd5d6", "concrete"),
    B("birch_planks", "Birch Planks", "light", "#d8caa0", "planks"),
    B("polished_diorite", "Polished Diorite", "light", "#d5d5d1", "stone"),
    B("white_wool", "White Wool", "light", "#e9ecec", "fabric"),
    B("snow_block", "Snow Block", "light", "#f2f6f6", "snow"),
    B("birch_log", "Birch Log", "light", "#d7cba7", "log"),
    B("jungle_log", "Jungle Log", "neutral", "#5b4425", "log"),

    // Neutral landscape and accents
    B("grass_block", "Grass Block", "neutral", "#6f8f43", "grass"),
    B("dirt", "Dirt", "neutral", "#6b4a2c", "dirt"),
    B("stone", "Stone", "neutral", "#7e7e7a", "stone"),
    B("water", "Water", "neutral", "#3d6f86", "water", { solid: false, transparent: true }),
    B("oak_log", "Oak Log", "neutral", "#6b4e2e", "log"),
    B("oak_leaves", "Oak Leaves", "neutral", "#4f7a34", "leaves"),
    B("spruce_log", "Spruce Log", "neutral", "#3d2b1a", "log"),
    B("spruce_leaves", "Spruce Leaves", "neutral", "#35552f", "leaves"),
    B("hay_block", "Hay Block", "neutral", "#b89a3e", "thatch"),
    B("gravel", "Gravel", "neutral", "#8c857c", "gravel"),
    B("oak_planks", "Oak Planks", "neutral", "#a98552", "planks"),
    B("spruce_planks", "Spruce Planks", "neutral", "#6d4f33", "planks"),
    B("cobblestone", "Cobblestone", "neutral", "#777772", "cobble"),
    B("mossy_cobblestone", "Mossy Cobblestone", "neutral", "#6c7663", "cobble"),
    B("stone_bricks", "Stone Bricks", "neutral", "#8e8e88", "stoneBrick"),
    B("chiseled_stone_bricks", "Chiseled Stone Bricks", "neutral", "#85857e", "stoneBrick"),
    B("mossy_stone_bricks", "Mossy Stone Bricks", "neutral", "#6e7a62", "stoneBrick"),
    B("sand", "Sand", "neutral", "#c9bd8f", "sand"),
    B("sandstone", "Sandstone", "neutral", "#cbbd94", "sand"),
    B("wheat", "Wheat", "neutral", "#b9a33e", "thatch"),
    B("gold_block", "Gold Block", "neutral", "#e8c34a", "metal", { emissive: 0.16 }),
    B("iron_block", "Iron Block", "neutral", "#b9b9b9", "metal"),
    B("glowstone", "Glowstone", "neutral", "#f5c76a", "glow", { emissive: 1.2 }),
    B("sea_lantern", "Sea Lantern", "neutral", "#b9d7cf", "glow", { emissive: 0.8 }),
    B("red_wool", "Red Wool", "neutral", "#8f2d2d", "fabric"),
    B("blue_wool", "Blue Wool", "neutral", "#2f477a", "fabric"),
    B("light_gray_concrete", "Light Gray Concrete", "neutral", "#a6a8a5", "concrete"),
    B("smooth_stone", "Smooth Stone", "neutral", "#a0a19c", "stone"),

    // Additional dark QR-capable materials
    B("obsidian", "Obsidian", "dark", "#120e1d", "stone"),
    B("crying_obsidian", "Crying Obsidian", "dark", "#230b3a", "crystal", { emissive: 0.15 }),
    B("reinforced_deepslate", "Reinforced Deepslate", "dark", "#4b4d4a", "stoneBrick"),
    B("gilded_blackstone", "Gilded Blackstone", "dark", "#3d2c1e", "stoneBrick", { emissive: 0.08 }),
    B("basalt", "Basalt", "dark", "#494950", "stone"),
    B("polished_basalt", "Polished Basalt", "dark", "#585862", "stone"),
    B("smooth_basalt", "Smooth Basalt", "dark", "#4b4b51", "stone"),
    B("tuff", "Tuff", "dark", "#6b6961", "stone"),
    B("tuff_bricks", "Tuff Bricks", "dark", "#66645e", "stoneBrick"),
    B("mud_bricks", "Mud Bricks", "dark", "#8b6a4f", "stoneBrick"),
    B("bricks", "Bricks", "dark", "#96624f", "stoneBrick"),
    B("red_nether_bricks", "Red Nether Bricks", "dark", "#450a0a", "stoneBrick"),
    B("dark_prismarine", "Dark Prismarine", "dark", "#2f5a4a", "tile"),
    B("netherite_block", "Netherite Block", "dark", "#3b3434", "metal"),
    B("coal_block", "Coal Block", "dark", "#141414", "mineral"),
    B("crimson_planks", "Crimson Planks", "dark", "#66334c", "planks"),
    B("warped_planks", "Warped Planks", "dark", "#2c5e5a", "planks"),
    B("crimson_stem", "Crimson Stem", "dark", "#5c2c42", "log"),
    B("warped_stem", "Warped Stem", "dark", "#3a4a4a", "log"),
    B("nether_wart_block", "Nether Wart Block", "dark", "#700d0d", "fabric"),
    B("warped_wart_block", "Warped Wart Block", "dark", "#167e86", "fabric"),

    // Additional light QR-capable materials
    B("end_stone", "End Stone", "light", "#dbde9f", "sand"),
    B("end_stone_bricks", "End Stone Bricks", "light", "#dbe1a5", "stoneBrick"),
    B("bone_block", "Bone Block", "light", "#e7e2cc", "mineral"),
    B("smooth_sandstone", "Smooth Sandstone", "light", "#e2d6b0", "sand"),
    B("quartz_bricks", "Quartz Bricks", "light", "#eae7e1", "stoneBrick"),

    // Stateful architectural detail blocks
    B("cobblestone_stairs", "Cobblestone Stairs", "neutral", "#777772", "cobble"),
    B("stone_brick_stairs", "Stone Brick Stairs", "neutral", "#8e8e88", "stoneBrick"),
    B("deepslate_tile_stairs", "Deepslate Tile Stairs", "dark", "#37383e", "tile"),
    B("deepslate_brick_stairs", "Deepslate Brick Stairs", "dark", "#46474e", "stoneBrick"),
    B("blackstone_stairs", "Blackstone Stairs", "dark", "#2c272c", "stone"),
    B("polished_blackstone_brick_stairs", "Polished Blackstone Brick Stairs", "dark", "#353039", "stoneBrick"),
    B("dark_oak_stairs", "Dark Oak Stairs", "dark", "#3e2a17", "planks"),
    B("crimson_stairs", "Crimson Stairs", "dark", "#66334c", "planks"),
    B("warped_stairs", "Warped Stairs", "dark", "#2c5e5a", "planks"),
    B("birch_stairs", "Birch Stairs", "light", "#d8caa0", "planks"),
    B("smooth_quartz_stairs", "Smooth Quartz Stairs", "light", "#eae7e1", "mineral"),
    B("quartz_stairs", "Quartz Stairs", "light", "#e8e5df", "mineral"),
    B("smooth_sandstone_stairs", "Smooth Sandstone Stairs", "light", "#e2d6b0", "sand"),
    B("polished_diorite_stairs", "Polished Diorite Stairs", "light", "#d5d5d1", "stone"),
    B("brick_stairs", "Brick Stairs", "dark", "#96624f", "stoneBrick"),
    B("mud_brick_stairs", "Mud Brick Stairs", "dark", "#8b6a4f", "stoneBrick"),
    B("nether_brick_stairs", "Nether Brick Stairs", "dark", "#2e181d", "stoneBrick"),
    B("end_stone_brick_stairs", "End Stone Brick Stairs", "light", "#dbe1a5", "stoneBrick"),

    B("cobblestone_slab", "Cobblestone Slab", "neutral", "#777772", "cobble"),
    B("stone_brick_slab", "Stone Brick Slab", "neutral", "#8e8e88", "stoneBrick"),
    B("smooth_stone_slab", "Smooth Stone Slab", "neutral", "#a0a19c", "stone"),
    B("deepslate_tile_slab", "Deepslate Tile Slab", "dark", "#37383e", "tile"),
    B("deepslate_brick_slab", "Deepslate Brick Slab", "dark", "#46474e", "stoneBrick"),
    B("blackstone_slab", "Blackstone Slab", "dark", "#2c272c", "stone"),
    B("polished_blackstone_brick_slab", "Polished Blackstone Brick Slab", "dark", "#353039", "stoneBrick"),
    B("dark_oak_slab", "Dark Oak Slab", "dark", "#3e2a17", "planks"),
    B("crimson_slab", "Crimson Slab", "dark", "#66334c", "planks"),
    B("warped_slab", "Warped Slab", "dark", "#2c5e5a", "planks"),
    B("birch_slab", "Birch Slab", "light", "#d8caa0", "planks"),
    B("smooth_quartz_slab", "Smooth Quartz Slab", "light", "#eae7e1", "mineral"),
    B("quartz_slab", "Quartz Slab", "light", "#e8e5df", "mineral"),
    B("smooth_sandstone_slab", "Smooth Sandstone Slab", "light", "#e2d6b0", "sand"),
    B("polished_diorite_slab", "Polished Diorite Slab", "light", "#d5d5d1", "stone"),
    B("brick_slab", "Brick Slab", "dark", "#96624f", "stoneBrick"),
    B("mud_brick_slab", "Mud Brick Slab", "dark", "#8b6a4f", "stoneBrick"),
    B("nether_brick_slab", "Nether Brick Slab", "dark", "#2e181d", "stoneBrick"),
    B("end_stone_brick_slab", "End Stone Brick Slab", "light", "#dbe1a5", "stoneBrick"),

    B("dark_oak_fence", "Dark Oak Fence", "dark", "#3e2a17", "planks"),
    B("birch_fence", "Birch Fence", "light", "#d8caa0", "planks"),
    B("dark_oak_fence_gate", "Dark Oak Fence Gate", "dark", "#3e2a17", "planks"),
    B("birch_fence_gate", "Birch Fence Gate", "light", "#d8caa0", "planks"),
    B("deepslate_brick_wall", "Deepslate Brick Wall", "dark", "#46474e", "stoneBrick"),
    B("blackstone_wall", "Blackstone Wall", "dark", "#2c272c", "stone"),
    B("polished_blackstone_brick_wall", "Polished Blackstone Brick Wall", "dark", "#353039", "stoneBrick"),
    B("stone_brick_wall", "Stone Brick Wall", "neutral", "#8e8e88", "stoneBrick"),
    B("cobblestone_wall", "Cobblestone Wall", "neutral", "#777772", "cobble"),

    B("dark_oak_door", "Dark Oak Door", "neutral", "#3e2a17", "planks"),
    B("birch_door", "Birch Door", "neutral", "#d8caa0", "planks"),
    B("crimson_door", "Crimson Door", "neutral", "#66334c", "planks"),
    B("warped_door", "Warped Door", "neutral", "#2c5e5a", "planks"),
    B("oak_door", "Oak Door", "neutral", "#a98552", "planks"),
    B("spruce_door", "Spruce Door", "neutral", "#6d4f33", "planks"),
    B("iron_door", "Iron Door", "neutral", "#b9b9b9", "metal"),

    B("dark_oak_trapdoor", "Dark Oak Trapdoor", "neutral", "#3e2a17", "planks"),
    B("birch_trapdoor", "Birch Trapdoor", "neutral", "#d8caa0", "planks"),
    B("glass", "Glass", "neutral", "#a9c2c8", "glass", { transparent: true }),
    B("glass_pane", "Glass Pane", "neutral", "#a9c2c8", "glass", { transparent: true }),
    B("iron_bars", "Iron Bars", "neutral", "#5c5c5c", "bars", { transparent: true }),
    B("lantern", "Lantern", "neutral", "#e8b85c", "glow", { emissive: 1 }),
    B("soul_lantern", "Soul Lantern", "neutral", "#6fc4c4", "glow", { emissive: 0.9 }),
    B("torch", "Torch", "neutral", "#e8c36b", "glow", { emissive: 1 }),
    B("wall_torch", "Wall Torch", "neutral", "#e8c36b", "glow", { emissive: 1 }),
    B("soul_wall_torch", "Soul Wall Torch", "neutral", "#6fc4c4", "glow", { emissive: 0.9 }),
    B("chain", "Chain", "neutral", "#55565a", "metal"),
    B("barrel", "Barrel", "neutral", "#6b4a2c", "planks"),
    B("bookshelf", "Bookshelf", "neutral", "#8a6b45", "planks"),
    B("flower_pot", "Flower Pot", "neutral", "#a46f4c", "mineral"),
    B("poppy", "Poppy", "neutral", "#c33a32", "flower"),
    B("dandelion", "Dandelion", "neutral", "#e8d04a", "flower"),
    B("azure_bluet", "Azure Bluet", "neutral", "#e5e7e0", "flower"),
    B("red_tulip", "Red Tulip", "neutral", "#c23b32", "flower"),
    B("white_tulip", "White Tulip", "neutral", "#eeeeea", "flower"),
    B("short_grass", "Short Grass", "neutral", "#6f8f43", "grass"),
    B("fern", "Fern", "neutral", "#5e7f3c", "grass"),
    B("lava", "Lava", "neutral", "#d45b18", "lava", { solid: false, transparent: true, emissive: 1 }),
    B("magma_block", "Magma Block", "neutral", "#8e3b1f", "lava", { emissive: 0.6 }),
    B("amethyst_block", "Amethyst Block", "neutral", "#8562b5", "crystal"),
    B("budding_amethyst", "Budding Amethyst", "neutral", "#8b6ab8", "crystal", { emissive: 0.18 }),
    B("amethyst_cluster", "Amethyst Cluster", "neutral", "#a77bd2", "crystal", { transparent: true, emissive: 0.4 }),
    B("large_amethyst_bud", "Large Amethyst Bud", "neutral", "#a47ccd", "crystal", { transparent: true, emissive: 0.3 }),
    B("ice", "Ice", "neutral", "#a9c8dd", "glass", { transparent: true }),
    B("packed_ice", "Packed Ice", "neutral", "#a4c4db", "mineral"),
    B("blue_ice", "Blue Ice", "neutral", "#7aa8d1", "mineral"),
    B("mushroom_stem", "Mushroom Stem", "neutral", "#d5d0c5", "log"),
    B("red_mushroom_block", "Red Mushroom Block", "neutral", "#b6302c", "fabric"),
    B("brown_mushroom_block", "Brown Mushroom Block", "neutral", "#8b6a4f", "fabric"),
    B("shroomlight", "Shroomlight", "neutral", "#e89250", "glow", { emissive: 1 }),
    B("jungle_leaves", "Jungle Leaves", "neutral", "#3d7a2e", "leaves"),
    B("birch_leaves", "Birch Leaves", "neutral", "#7c9a5a", "leaves"),
    B("dark_oak_leaves", "Dark Oak Leaves", "neutral", "#315022", "leaves"),
    B("pale_oak_planks", "Pale Oak Planks", "neutral", "#d9d2c1", "planks"),
    B("crimson_nylium", "Crimson Nylium", "neutral", "#7a1f2b", "grass"),
    B("warped_nylium", "Warped Nylium", "neutral", "#2f6b5c", "grass"),
    B("sandstone_stairs", "Sandstone Stairs", "neutral", "#cbbd94", "sand"),
    B("sandstone_slab", "Sandstone Slab", "neutral", "#cbbd94", "sand"),
    B("moss_carpet", "Moss Carpet", "neutral", "#5c7a3d", "grass"),
    B("copper_block", "Copper Block", "neutral", "#c06f4e", "metal"),
    B("exposed_copper", "Exposed Copper", "neutral", "#a66b52", "metal"),
    B("weathered_copper", "Weathered Copper", "neutral", "#6c9a78", "metal"),
    B("oxidized_copper", "Oxidized Copper", "neutral", "#4f9a7a", "metal"),
    B("cut_copper", "Cut Copper", "neutral", "#bf6b4b", "metal"),
    B("oxidized_cut_copper", "Oxidized Cut Copper", "neutral", "#4f9a7a", "metal"),
  ].map((block) => [block.id, block]),
);

export const AIR = "minecraft:air";

export const ORDERED_BLOCK_IDS = Object.keys(BLOCKS);

export function getBlock(id: string): BlockDefinition {
  const block = BLOCKS[baseBlockId(id)];
  if (!block) {
    throw new Error(`Unknown block in QRCraft registry: ${id}`);
  }
  return block;
}

export function isOpaque(id: string): boolean {
  const base = baseBlockId(id);
  if (base === AIR) return false;
  const block = BLOCKS[base];
  if (!block) return true;
  return !block.transparent;
}

export {
  materialsFor,
  STYLE_IDS,
  STYLE_ORDER,
  STYLES,
  styleFor,
  type StyleId,
} from "@/lib/blocks/styles";

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
