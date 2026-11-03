import { blockState } from "@/lib/blocks/state";

/**
 * Semantic Minecraft block states used by the detailed architecture passes.
 *
 * Every helper returns a full state string. Structural code and the QR
 * projector use the base id, while the renderer and schematic exporter retain
 * the properties. Only properties that exist in Minecraft 1.21.4 are emitted.
 */

export type Facing = "north" | "south" | "east" | "west";
export type Half = "bottom" | "top";

const STAIRS: Record<string, string> = {
  "minecraft:cobblestone": "minecraft:cobblestone_stairs",
  "minecraft:mossy_cobblestone": "minecraft:cobblestone_stairs",
  "minecraft:stone_bricks": "minecraft:stone_brick_stairs",
  "minecraft:chiseled_stone_bricks": "minecraft:stone_brick_stairs",
  "minecraft:mossy_stone_bricks": "minecraft:stone_brick_stairs",
  "minecraft:deepslate_tiles": "minecraft:deepslate_tile_stairs",
  "minecraft:deepslate_bricks": "minecraft:deepslate_brick_stairs",
  "minecraft:blackstone": "minecraft:blackstone_stairs",
  "minecraft:polished_blackstone_bricks": "minecraft:polished_blackstone_brick_stairs",
  "minecraft:dark_oak_planks": "minecraft:dark_oak_stairs",
  "minecraft:crimson_planks": "minecraft:crimson_stairs",
  "minecraft:warped_planks": "minecraft:warped_stairs",
  "minecraft:birch_planks": "minecraft:birch_stairs",
  "minecraft:smooth_quartz": "minecraft:smooth_quartz_stairs",
  "minecraft:quartz_block": "minecraft:quartz_stairs",
  "minecraft:smooth_sandstone": "minecraft:smooth_sandstone_stairs",
  "minecraft:sandstone": "minecraft:sandstone_stairs",
  "minecraft:polished_diorite": "minecraft:polished_diorite_stairs",
  "minecraft:bricks": "minecraft:brick_stairs",
  "minecraft:mud_bricks": "minecraft:mud_brick_stairs",
  "minecraft:nether_bricks": "minecraft:nether_brick_stairs",
  "minecraft:end_stone_bricks": "minecraft:end_stone_brick_stairs",
};

const SLABS: Record<string, string> = {
  "minecraft:cobblestone": "minecraft:cobblestone_slab",
  "minecraft:mossy_cobblestone": "minecraft:cobblestone_slab",
  "minecraft:stone_bricks": "minecraft:stone_brick_slab",
  "minecraft:chiseled_stone_bricks": "minecraft:stone_brick_slab",
  "minecraft:mossy_stone_bricks": "minecraft:stone_brick_slab",
  "minecraft:smooth_stone": "minecraft:smooth_stone_slab",
  "minecraft:deepslate_tiles": "minecraft:deepslate_tile_slab",
  "minecraft:deepslate_bricks": "minecraft:deepslate_brick_slab",
  "minecraft:blackstone": "minecraft:blackstone_slab",
  "minecraft:polished_blackstone_bricks": "minecraft:polished_blackstone_brick_slab",
  "minecraft:dark_oak_planks": "minecraft:dark_oak_slab",
  "minecraft:crimson_planks": "minecraft:crimson_slab",
  "minecraft:warped_planks": "minecraft:warped_slab",
  "minecraft:birch_planks": "minecraft:birch_slab",
  "minecraft:smooth_quartz": "minecraft:smooth_quartz_slab",
  "minecraft:quartz_block": "minecraft:quartz_slab",
  "minecraft:smooth_sandstone": "minecraft:smooth_sandstone_slab",
  "minecraft:sandstone": "minecraft:sandstone_slab",
  "minecraft:polished_diorite": "minecraft:polished_diorite_slab",
  "minecraft:bricks": "minecraft:brick_slab",
  "minecraft:mud_bricks": "minecraft:mud_brick_slab",
  "minecraft:nether_bricks": "minecraft:nether_brick_slab",
  "minecraft:end_stone_bricks": "minecraft:end_stone_brick_slab",
};

const FENCES: Record<string, string> = {
  "minecraft:dark_oak_planks": "minecraft:dark_oak_fence",
  "minecraft:birch_planks": "minecraft:birch_fence",
};

const WALLS: Record<string, string> = {
  "minecraft:cobblestone": "minecraft:cobblestone_wall",
  "minecraft:mossy_cobblestone": "minecraft:cobblestone_wall",
  "minecraft:stone_bricks": "minecraft:stone_brick_wall",
  "minecraft:chiseled_stone_bricks": "minecraft:stone_brick_wall",
  "minecraft:mossy_stone_bricks": "minecraft:stone_brick_wall",
  "minecraft:deepslate_bricks": "minecraft:deepslate_brick_wall",
  "minecraft:blackstone": "minecraft:blackstone_wall",
  "minecraft:polished_blackstone_bricks": "minecraft:polished_blackstone_brick_wall",
};

const TRAPDOORS: Record<string, string> = {
  "minecraft:dark_oak_planks": "minecraft:dark_oak_trapdoor",
  "minecraft:birch_planks": "minecraft:birch_trapdoor",
};

export function stairFor(base: string): string | null {
  return STAIRS[base] ?? null;
}

export function slabFor(base: string): string | null {
  return SLABS[base] ?? null;
}

export function fenceFor(base: string): string | null {
  return FENCES[base] ?? null;
}

export function wallFor(base: string): string | null {
  return WALLS[base] ?? null;
}

export function trapdoorFor(base: string): string | null {
  return TRAPDOORS[base] ?? null;
}

export function stairState(
  stair: string,
  facing: Facing,
  half: Half = "bottom",
): string {
  return blockState(stair, {
    facing,
    half,
    shape: "straight",
    waterlogged: false,
  });
}

export function slabState(slab: string, half: Half = "bottom"): string {
  return blockState(slab, { type: half === "top" ? "top" : "bottom", waterlogged: false });
}

export function fenceState(fence: string, connected = true): string {
  return blockState(fence, {
    east: connected,
    north: connected,
    south: connected,
    waterlogged: false,
    west: connected,
  });
}

export function wallState(wall: string, connected = true): string {
  // Wall side properties are three-state enums in Minecraft, not booleans:
  // `none`, `low` or `tall`. Writing true/false here would be an invalid state.
  const side = connected ? "tall" : "none";
  return blockState(wall, {
    east: side,
    north: side,
    south: side,
    up: connected,
    waterlogged: false,
    west: side,
  });
}

export function trapdoorState(
  trapdoor: string,
  facing: Facing,
  open = true,
  half: Half = "top",
): string {
  return blockState(trapdoor, {
    facing,
    half,
    open,
    powered: false,
    waterlogged: false,
  });
}

export function lanternState(hanging: boolean): string {
  return blockState("minecraft:lantern", { hanging, waterlogged: false });
}

export function soulLanternState(hanging: boolean): string {
  return blockState("minecraft:soul_lantern", { hanging, waterlogged: false });
}

export function doorStates(
  door: string,
  facing: Facing,
  hinge: "left" | "right" = "left",
): [lower: string, upper: string] {
  const base = door.endsWith("_door") ? door : "minecraft:oak_door";
  return [
    blockState(base, { facing, half: "lower", hinge, open: false, powered: false }),
    blockState(base, { facing, half: "upper", hinge, open: false, powered: false }),
  ];
}

export function ironBarsState(): string {
  return blockState("minecraft:iron_bars", {
    east: false,
    north: false,
    south: false,
    waterlogged: false,
    west: false,
  });
}

export function chainState(axis: "x" | "y" | "z" = "y"): string {
  return blockState("minecraft:chain", {
    axis,
    waterlogged: false,
  });
}
