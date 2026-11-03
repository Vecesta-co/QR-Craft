import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import type { SiteLayout, Rect } from "@/lib/world/site";
import { insideRect } from "@/lib/world/site";
import type { OuterFeatureKind, WorldSiteDefinition } from "@/lib/sites/types";
import { createRng, type Rng } from "@/lib/world/rng";

const AIR = "minecraft:air";
const WATER = "minecraft:water";
const LAVA = "minecraft:lava";
const STONE = "minecraft:stone";
const COBBLE = "minecraft:cobblestone";
const STONE_BRICKS = "minecraft:stone_bricks";
const MOSSY = "minecraft:mossy_stone_bricks";
const DEEPSLATE = "minecraft:deepslate";
const DEEPSLATE_BRICKS = "minecraft:deepslate_bricks";
const BLACKSTONE = "minecraft:blackstone";
const BASALT = "minecraft:basalt";
const OBSIDIAN = "minecraft:obsidian";
const DARK_OAK = "minecraft:dark_oak_planks";
const DARK_OAK_LOG = "minecraft:dark_oak_log";
const OAK = "minecraft:oak_planks";
const OAK_LOG = "minecraft:oak_log";
const OAK_LEAVES = "minecraft:oak_leaves";
const BIRCH_LOG = "minecraft:birch_log";
const BIRCH_LEAVES = "minecraft:birch_leaves";
const JUNGLE_LOG = "minecraft:jungle_log";
const JUNGLE_LEAVES = "minecraft:jungle_leaves";
const SPRUCE_LOG = "minecraft:spruce_log";
const MUSHROOM_STEM = "minecraft:mushroom_stem";
const RED_MUSHROOM = "minecraft:red_mushroom_block";
const BROWN_MUSHROOM = "minecraft:brown_mushroom_block";
const SHROOMLIGHT = "minecraft:shroomlight";
const AMETHYST = "minecraft:amethyst_block";
const AMETHYST_BUD = "minecraft:amethyst_cluster";
const SAND = "minecraft:sand";
const SANDSTONE = "minecraft:smooth_sandstone";
const GRASS = "minecraft:grass_block";
const SNOW = "minecraft:snow_block";
const GRAVEL = "minecraft:gravel";
const BRICKS = "minecraft:bricks";
const GLOWSTONE = "minecraft:glowstone";
const SEA_LANTERN = "minecraft:sea_lantern";
const LANTERN = "minecraft:lantern";
const IRON_BARS = "minecraft:iron_bars";
const WHITE_WOOL = "minecraft:white_wool";
const BLACK_WOOL = "minecraft:black_wool";
const GOLD = "minecraft:gold_block";
const COPPER = "minecraft:copper_block";
const DARK_PRISMARINE = "minecraft:dark_prismarine";
const MAGMA = "minecraft:magma_block";
const FARMLAND = "minecraft:dirt";

export interface SiteFeatureBuildResult {
  names: string[];
  rects: Rect[];
}

export interface SiteFeaturePlanEntry {
  kind: OuterFeatureKind;
  rect: Rect;
}

const FEATURE_LABELS: Record<OuterFeatureKind, string> = {
  "giant-tree": "Giant tree",
  "sky-islands": "Sky islands",
  "pirate-ship": "Pirate ship",
  lighthouse: "Lighthouse",
  harbor: "Harbor and docks",
  "mountain-gate": "Mountain gate",
  "temple-ruins": "Temple ruins",
  monastery: "Monastery",
  volcano: "Volcano",
  "lava-channels": "Lava channels",
  "crystal-cavern": "Crystal cavern",
  "giant-mushrooms": "Giant mushrooms",
  oasis: "Oasis",
  canals: "Canals",
  smokestacks: "Smokestacks",
  terraces: "Terraces",
  ruins: "Ruins",
  "stone-circle": "Stone circle",
  waterfall: "Waterfall",
  windmill: "Windmill",
  "sky-bridges": "Sky bridges",
  none: "Site feature",
};

export function siteFeatureLabel(kind: OuterFeatureKind): string {
  return FEATURE_LABELS[kind];
}

/**
 * The exact landscape rectangles a site will use. Terrain builders consult this
 * before placing fields or a hamlet so the outer landmarks never overwrite
 * farmland and are never overwritten by it.
 */
export function planSiteFeatures(
  layout: SiteLayout,
  site: WorldSiteDefinition,
): SiteFeaturePlanEntry[] {
  if (site.legacy) return [];
  const queue: OuterFeatureKind[] = [
    site.landmarks.primary,
    ...site.landmarks.secondary,
  ].filter((kind): kind is OuterFeatureKind => kind !== "none");
  const plan: SiteFeaturePlanEntry[] = [];
  for (let i = 0; i < Math.min(queue.length, 3); i++) {
    const rect = featureArea(layout, i);
    if (rect) plan.push({ kind: queue[i], rect });
  }
  return plan;
}

interface FeatureContext {
  world: VoxelWorld;
  layout: SiteLayout;
  heights: Int16Array;
  rng: Rng;
  area: Rect;
  centerX: number;
  centerZ: number;
  radius: number;
  groundY: number;
  index: number;
}

export function buildSiteFeatures(
  world: VoxelWorld,
  layout: SiteLayout,
  site: WorldSiteDefinition,
  heights: Int16Array,
  seed: number,
): SiteFeatureBuildResult {
  const plan = planSiteFeatures(layout, site);
  if (plan.length === 0) return { names: [], rects: [] };

  const rng = createRng(seed ^ 0x5f3a1d);
  const rects: Rect[] = [];
  const names: string[] = [];
  for (const { kind, rect: area } of plan) {
    const ctx: FeatureContext = {
      world,
      layout,
      heights,
      rng,
      area,
      centerX: Math.floor((area.x1 + area.x2) / 2),
      centerZ: Math.floor((area.z1 + area.z2) / 2),
      radius: Math.max(3, Math.min(area.x2 - area.x1, area.z2 - area.z1) >> 1),
      groundY: heights[Math.floor((area.z1 + area.z2) / 2) * layout.worldSize + Math.floor((area.x1 + area.x2) / 2)] ?? 18,
      index: rects.length,
    };
    activeFeatureClip = area;
    try {
      buildFeature(kind, ctx);
    } finally {
      activeFeatureClip = null;
    }
    rects.push(area);
    names.push(siteFeatureLabel(kind));
  }
  return { names, rects };
}

function featureArea(layout: SiteLayout, index: number): Rect | null {
  const size = layout.worldSize;
  const moat = layout.moatRect;
  const left = moat.x1 - 2;
  const right = size - moat.x2 - 3;
  const top = moat.z1 - 2;
  const bottom = size - moat.z2 - 3;
  const slots: Array<{ horizontal: number; vertical: number; x: number; z: number }> = [
    { horizontal: left, vertical: left, x: Math.floor(left / 2), z: Math.floor(size * 0.38) },
    { horizontal: right, vertical: right, x: size - 1 - Math.floor(right / 2), z: Math.floor(size * 0.62) },
    { horizontal: top, vertical: top, x: Math.floor(size * 0.5), z: Math.floor(top / 2) },
    { horizontal: bottom, vertical: bottom, x: Math.floor(size * 0.3), z: size - 1 - Math.floor(bottom / 2) },
  ];
  const slot = slots[index % slots.length];
  const horizontalRadius = Math.max(3, Math.min(28, Math.floor(slot.horizontal / 2) - 1));
  const verticalRadius = Math.max(3, Math.min(28, Math.floor(slot.vertical / 2) - 1));
  const radius = Math.min(horizontalRadius, verticalRadius);
  if (radius < 4) return null;
  const area: Rect = {
    x1: Math.max(2, slot.x - radius),
    x2: Math.min(size - 3, slot.x + radius),
    z1: Math.max(2, slot.z - radius),
    z2: Math.min(size - 3, slot.z + radius),
  };
  if (area.x2 - area.x1 < 6 || area.z2 - area.z1 < 6) return null;
  if (insideRect(area.x1, area.z1, layout.moatRect)) return null;
  if (area.x1 <= layout.moatRect.x1 && area.x2 >= layout.moatRect.x1) return null;
  if (area.z1 <= layout.moatRect.z1 && area.z2 >= layout.moatRect.z1) return null;
  return area;
}

function buildFeature(kind: OuterFeatureKind, ctx: FeatureContext): void {
  switch (kind) {
    case "giant-tree":
      giantTree(ctx);
      break;
    case "sky-islands":
      skyIslands(ctx);
      break;
    case "pirate-ship":
      pirateShip(ctx);
      break;
    case "lighthouse":
      lighthouse(ctx);
      break;
    case "harbor":
      harbor(ctx);
      break;
    case "mountain-gate":
      mountainGate(ctx);
      break;
    case "temple-ruins":
      templeRuins(ctx);
      break;
    case "monastery":
      monastery(ctx);
      break;
    case "volcano":
      volcano(ctx);
      break;
    case "lava-channels":
      lavaChannels(ctx);
      break;
    case "crystal-cavern":
      crystalCavern(ctx);
      break;
    case "giant-mushrooms":
      giantMushrooms(ctx);
      break;
    case "oasis":
      oasis(ctx);
      break;
    case "canals":
      canals(ctx);
      break;
    case "smokestacks":
      smokestacks(ctx);
      break;
    case "terraces":
      terraces(ctx);
      break;
    case "ruins":
      ruins(ctx);
      break;
    case "stone-circle":
      stoneCircle(ctx);
      break;
    case "waterfall":
      waterfall(ctx);
      break;
    case "windmill":
      windmill(ctx);
      break;
    case "sky-bridges":
      skyBridges(ctx);
      break;
    case "none":
      break;
  }
}

let activeFeatureClip: Rect | null = null;

function place(world: VoxelWorld, x: number, y: number, z: number, block: string): void {
  if (activeFeatureClip && !insideRect(x, z, activeFeatureClip)) return;
  if (world.inBounds(x, y, z)) world.set(x, y, z, block);
}

function setIfAir(world: VoxelWorld, x: number, y: number, z: number, block: string): void {
  if (activeFeatureClip && !insideRect(x, z, activeFeatureClip)) return;
  if (world.inBounds(x, y, z) && world.get(x, y, z) === AIR) world.set(x, y, z, block);
}

function pad(ctx: FeatureContext, y: number, block: string, rim?: string): void {
  const { area } = ctx;
  for (let z = area.z1; z <= area.z2; z++) {
    for (let x = area.x1; x <= area.x2; x++) {
      for (let yy = 0; yy < y; yy++) {
        place(ctx.world, x, yy, z, yy === y - 1 ? block : ctx.heights[z * ctx.layout.worldSize + x] > y - 3 ? block : STONE);
      }
      ctx.heights[z * ctx.layout.worldSize + x] = y;
      for (let yy = y; yy < ctx.world.sizeY; yy++) place(ctx.world, x, yy, z, AIR);
      if (rim) {
        const edge = x === area.x1 || x === area.x2 || z === area.z1 || z === area.z2;
        if (edge) place(ctx.world, x, y, z, rim);
      }
    }
  }
}

function cylinder(
  world: VoxelWorld,
  cx: number,
  cz: number,
  fromY: number,
  toY: number,
  radius: number,
  block: string,
): void {
  for (let y = fromY; y <= toY; y++) {
    for (let z = -radius; z <= radius; z++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + z * z <= radius * radius) place(world, cx + x, y, cz + z, block);
      }
    }
  }
}

function giantTree(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  const radius = Math.max(7, Math.min(14, ctx.radius - 1));
  const height = Math.max(24, Math.min(48, Math.round(ctx.radius * 2.4)));
  pad(ctx, groundY + 1, GRASS);
  const trunkRadius = Math.max(2, Math.min(5, Math.floor(radius / 3)));
  for (let y = 0; y <= height; y++) {
    const taper = y > height * 0.75 ? Math.max(1, trunkRadius - 2) : trunkRadius;
    for (let z = -taper; z <= taper; z++) {
      for (let x = -taper; x <= taper; x++) {
        if (x * x + z * z <= taper * taper) place(world, centerX + x, groundY + y, centerZ + z, DARK_OAK_LOG);
      }
    }
  }
  // Root buttresses.
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const length = rng.int(radius - 2, radius + 4);
    for (let r = 1; r <= length; r++) {
      const x = centerX + Math.round(Math.cos(angle) * r);
      const z = centerZ + Math.round(Math.sin(angle) * r);
      const y = groundY + Math.max(0, 2 - Math.floor(r / 4));
      place(world, x, y, z, DARK_OAK_LOG);
      place(world, x, y - 1, z, DARK_OAK_LOG);
    }
  }
  // Broad canopy with a few gaps.
  const canopyY = groundY + height - 4;
  const canopyRadius = radius + 6;
  for (let y = -8; y <= 9; y++) {
    const rr = Math.max(2, Math.round(canopyRadius * Math.sqrt(Math.max(0.1, 1 - Math.abs(y) / 10))));
    for (let z = -rr; z <= rr; z++) {
      for (let x = -rr; x <= rr; x++) {
        if (x * x + z * z > rr * rr) continue;
        if (rng.chance(0.18)) continue;
        setIfAir(world, centerX + x, canopyY + y, centerZ + z, OAK_LEAVES);
      }
    }
  }
  // Treehouse platform and shrine.
  const platformY = groundY + Math.round(height * 0.58);
  for (let z = -5; z <= 5; z++) {
    for (let x = -5; x <= 5; x++) {
      if (Math.abs(x) + Math.abs(z) > 7) continue;
      if (x * x + z * z <= trunkRadius * trunkRadius + 1) continue;
      place(world, centerX + x, platformY, centerZ + z, OAK);
    }
  }
  for (const [dx, dz] of [
    [-5, -5],
    [-5, 5],
    [5, -5],
    [5, 5],
  ]) {
    place(world, centerX + dx, platformY + 1, centerZ + dz, DARK_OAK_LOG);
    place(world, centerX + dx, platformY + 2, centerZ + dz, DARK_OAK_LOG);
    place(world, centerX + dx, platformY + 3, centerZ + dz, LANTERN);
  }
  // Small timber pavilion on the platform.
  for (let z = -2; z <= 1; z++) {
    for (let x = -2; x <= 1; x++) {
      const edge = x === -2 || x === 1 || z === -2 || z === 1;
      if (!edge) continue;
      for (let y = 1; y <= 3; y++) place(world, centerX + x, platformY + y, centerZ + z, y === 3 ? DARK_OAK : OAK_LOG);
    }
  }
  for (let z = -3; z <= 2; z++) {
    for (let x = -3; x <= 2; x++) place(world, centerX + x, platformY + 4, centerZ + z, SPRUCE_LOG);
  }
  for (let y = groundY + 4; y < platformY; y += 6) {
    place(world, centerX + trunkRadius + 1, y, centerZ, LANTERN);
  }
}

function giantMushrooms(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, GRASS);
  const count = Math.min(4, Math.max(2, Math.floor(ctx.radius / 5)));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.4;
    const distance = i === 0 ? 0 : rng.int(4, Math.max(5, ctx.radius - 4));
    const x = centerX + Math.round(Math.cos(angle) * distance);
    const z = centerZ + Math.round(Math.sin(angle) * distance);
    const height = rng.int(10, 24);
    const capRadius = Math.max(3, Math.round(height / 3));
    for (let y = 0; y < height; y++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx * dx + dz * dz > 1) continue;
          place(world, x + dx, groundY + 1 + y, z + dz, MUSHROOM_STEM);
        }
      }
    }
    const cap = rng.chance(0.55) ? RED_MUSHROOM : BROWN_MUSHROOM;
    for (let dy = 0; dy <= 2; dy++) {
      const rr = capRadius - dy;
      for (let dz = -rr; dz <= rr; dz++) {
        for (let dx = -rr; dx <= rr; dx++) {
          if (dx * dx + dz * dz > rr * rr) continue;
          place(world, x + dx, groundY + height + dy, z + dz, cap);
        }
      }
    }
    for (const [dx, dz] of [
      [-capRadius, 0],
      [capRadius, 0],
      [0, -capRadius],
      [0, capRadius],
    ]) {
      place(world, x + dx, groundY + height - 1, z + dz, SHROOMLIGHT);
    }
  }
  // Glowing pool and stepping stones.
  const poolY = groundY + 1;
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      if (x * x + z * z > 9) continue;
      place(world, centerX + x, poolY, centerZ + z, WATER);
      place(world, centerX + x, poolY - 1, centerZ + z, SHROOMLIGHT);
    }
  }
  for (const [dx, dz] of [
    [-3, -3],
    [-3, 3],
    [3, -3],
    [3, 3],
  ]) {
    place(world, centerX + dx, poolY + 1, centerZ + dz, BROWN_MUSHROOM);
  }
}

function skyIslands(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  // The ground below the city remains a low cloud shelf, while these islands
  // hang above the outer landscape without touching the QR projection.
  pad(ctx, Math.max(8, groundY), "minecraft:white_wool");
  for (let i = 0; i < 3; i++) {
    const cx = centerX + (i - 1) * Math.max(7, Math.floor(ctx.radius * 0.7));
    const cz = centerZ + (i === 1 ? -Math.floor(ctx.radius * 0.35) : Math.floor(ctx.radius * 0.25));
    const top = 45 + rng.int(0, 9) + i * 2;
    const rr = Math.max(5, ctx.radius - i * 2);
    for (let y = 0; y < 7; y++) {
      const ring = Math.max(1, rr - y);
      for (let z = -ring; z <= ring; z++) {
        for (let x = -ring; x <= ring; x++) {
          if (x * x + z * z > ring * ring) continue;
          place(world, cx + x, top - y, cz + z, y === 0 ? GRASS : y < 3 ? "minecraft:dirt" : STONE);
        }
      }
    }
    for (let z = -rr + 1; z <= rr - 1; z++) {
      for (let x = -rr + 1; x <= rr - 1; x++) {
        if (x * x + z * z > (rr - 1) * (rr - 1)) continue;
        if (rng.chance(0.12)) continue;
        place(world, cx + x, top + 1, cz + z, BIRCH_LOG);
        if (rng.chance(0.5)) place(world, cx + x, top + 2, cz + z, BIRCH_LEAVES);
      }
    }
    // Hanging underside.
    for (let y = 1; y <= 9; y++) {
      const ring = Math.max(0, Math.floor((rr - 2) * (1 - y / 10)));
      for (let z = -ring; z <= ring; z++) {
        for (let x = -ring; x <= ring; x++) {
          if (x * x + z * z <= ring * ring + 1) place(world, cx + x, top - 7 - y, cz + z, DEEPSLATE);
        }
      }
    }
    // Waterfall off the edge.
    for (let y = top - 8; y > Math.max(3, groundY + 2); y--) {
      place(world, cx + rr - 1, y, cz, WATER);
    }
    for (let y = 1; y <= 3; y++) {
      place(world, cx, top + y, cz, LANTERN);
    }
  }
}

function pirateShip(ctx: FeatureContext): void {
  const { world, centerX, centerZ, rng } = ctx;
  const waterY = 17;
  pad(ctx, waterY + 1, WATER);
  const length = Math.max(12, Math.min(26, ctx.radius * 2 - 2));
  const halfWidth = Math.max(3, Math.min(6, Math.floor(length / 4)));
  const bow = centerX + Math.floor(length / 2);
  const stern = centerX - Math.floor(length / 2);
  for (let x = stern; x <= bow; x++) {
    const taper = Math.round((1 - Math.abs(x - centerX) / (length / 2)) * 2);
    const width = Math.max(1, halfWidth - taper);
    for (let z = -width; z <= width; z++) {
      place(world, x, waterY - 3, centerZ + z, DARK_OAK);
      place(world, x, waterY - 2, centerZ + z, DARK_OAK_LOG);
      place(world, x, waterY - 1, centerZ + z, DARK_OAK);
      place(world, x, waterY, centerZ + z, DARK_OAK);
      if (Math.abs(z) === width) {
        place(world, x, waterY + 1, centerZ + z, DARK_OAK);
        place(world, x, waterY + 2, centerZ + z, DARK_OAK);
      }
    }
  }
  // Deck, masts and sails.
  for (let x = stern + 3; x <= bow - 3; x++) {
    for (let z = -halfWidth; z <= halfWidth; z++) {
      place(world, x, waterY + 1, centerZ + z, OAK);
    }
  }
  const masts = [centerX - 4, centerX + 3];
  for (const mastX of masts) {
    for (let y = waterY + 2; y <= waterY + 20; y++) {
      place(world, mastX, y, centerZ, DARK_OAK_LOG);
      place(world, mastX, y, centerZ - 1, DARK_OAK_LOG);
    }
    for (let y = waterY + 10; y <= waterY + 17; y++) {
      for (let z = -5; z <= 5; z++) {
        if (Math.abs(z) < 2) continue;
        place(world, mastX + (y % 2 === 0 ? 1 : -1), y, centerZ + z, WHITE_WOOL);
      }
    }
  }
  // Cabin, wheel and rail details.
  for (let x = stern + 2; x <= stern + 7; x++) {
    for (let z = -halfWidth + 1; z <= halfWidth - 1; z++) {
      for (let y = waterY + 2; y <= waterY + 5; y++) {
        const edge = x === stern + 2 || x === stern + 7 || z === -halfWidth + 1 || z === halfWidth - 1;
        if (edge) place(world, x, y, centerZ + z, DARK_OAK);
      }
    }
  }
  for (let y = waterY + 6; y <= waterY + 7; y++) {
    for (let z = -halfWidth; z <= halfWidth; z++) {
      for (let x = stern + 1; x <= stern + 8; x++) {
        place(world, x, y, centerZ + z, x === stern + 1 || x === stern + 8 ? DARK_OAK : DARK_OAK_LOG);
      }
    }
  }
  place(world, centerX, waterY + 21, centerZ, BLACK_WOOL);
  place(world, centerX, waterY + 22, centerZ, BLACK_WOOL);
  for (let z = -halfWidth; z <= halfWidth; z += 2) {
    place(world, bow - 2, waterY + 3, centerZ + z, GOLD);
  }
  for (const x of [stern + 3, bow - 3]) {
    place(world, x, waterY + 3, centerZ - halfWidth, LANTERN);
    place(world, x, waterY + 3, centerZ + halfWidth, LANTERN);
  }
  void rng;
}

function lighthouse(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY } = ctx;
  pad(ctx, groundY + 1, GRASS, COBBLE);
  const height = Math.max(16, Math.min(30, ctx.radius + 10));
  for (let y = 0; y <= height; y++) {
    const radius = Math.max(2, 4 - Math.floor(y / 12));
    cylinder(world, centerX, centerZ, groundY + 1 + y, groundY + 1 + y, radius, y % 6 < 3 ? WHITE_WOOL : BRICKS);
  }
  const lampY = groundY + height + 1;
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      if (x * x + z * z > 9) continue;
      place(world, centerX + x, lampY, centerZ + z, GLOWSTONE);
      place(world, centerX + x, lampY + 3, centerZ + z, DARK_PRISMARINE);
    }
  }
  for (const [dx, dz] of [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ]) {
    place(world, centerX + dx, lampY + 1, centerZ + dz, IRON_BARS);
  }
  place(world, centerX, lampY + 4, centerZ, COPPER);
  // Keeper's cottage.
  for (let z = -4; z <= 2; z++) {
    for (let x = 3; x <= 9; x++) {
      for (let y = groundY + 1; y <= groundY + 4; y++) {
        const edge = x === 3 || x === 9 || z === -4 || z === 2;
        if (edge) place(world, centerX + x, y, centerZ + z, WHITE_WOOL);
      }
    }
  }
  for (let z = -5; z <= 3; z++) {
    for (let x = 2; x <= 10; x++) place(world, centerX + x, groundY + 5, centerZ + z, "minecraft:smooth_quartz");
  }
  place(world, centerX + 6, groundY + 2, centerZ + 2, DARK_OAK);
}

function harbor(ctx: FeatureContext): void {
  const { world, centerX, centerZ, rng } = ctx;
  const waterY = 17;
  pad(ctx, waterY + 1, WATER);
  for (let z = -5; z <= 5; z++) {
    for (let x = -ctx.radius + 2; x <= ctx.radius - 2; x++) {
      place(world, centerX + x, waterY + 1, centerZ + z, x % 3 === 0 ? OAK : DARK_OAK);
      if (Math.abs(z) === 5) {
        place(world, centerX + x, waterY + 2, centerZ + z, DARK_OAK_LOG);
      }
    }
  }
  for (let x = -ctx.radius + 3; x <= ctx.radius - 3; x += 4) {
    for (const z of [-4, 4]) {
      for (let y = waterY - 3; y <= waterY + 1; y++) place(world, centerX + x, y, centerZ + z, DARK_OAK_LOG);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = centerX + rng.int(-ctx.radius + 4, ctx.radius - 4);
    const z = centerZ + rng.int(-3, 3);
    place(world, x, waterY + 2, z, "minecraft:barrel");
    if (rng.chance(0.5)) place(world, x + 1, waterY + 2, z, "minecraft:barrel");
  }
  for (let x = -3; x <= 3; x++) {
    for (let z = -2; z <= 2; z++) {
      place(world, centerX + x, waterY + 1, centerZ + 7 + z, OAK);
    }
  }
  for (const x of [-3, 3]) {
    for (const z of [5, 9]) place(world, centerX + x, waterY + 2, centerZ + z, LANTERN);
  }
  // Small moored boat.
  for (let x = -3; x <= 3; x++) {
    for (let z = -1; z <= 1; z++) {
      place(world, centerX + x, waterY, centerZ + 8 + z, DARK_OAK);
    }
  }
  place(world, centerX, waterY + 1, centerZ + 8, DARK_OAK);
  place(world, centerX + 3, waterY + 1, centerZ + 8, LANTERN);
}

function mountainGate(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY } = ctx;
  pad(ctx, groundY + 1, STONE);
  const height = Math.max(14, Math.min(28, ctx.radius + 8));
  const half = Math.max(5, Math.min(9, ctx.radius - 1));
  // Mountain mass behind the gate.
  for (let z = -half; z <= half; z++) {
    for (let x = -half - 5; x <= half + 5; x++) {
      const h = Math.round((1 - Math.abs(x) / (half + 6)) * height * 1.25);
      for (let y = 1; y <= h; y++) place(world, centerX + x, groundY + y, centerZ + z, y > h - 4 ? SNOW : y > h - 8 ? STONE : DEEPSLATE);
    }
  }
  // Gate opening.
  for (let z = -half + 1; z <= half - 1; z++) {
    for (let x = -3; x <= 3; x++) {
      for (let y = 1; y <= 10; y++) place(world, centerX + x, groundY + y, centerZ + z, AIR);
    }
  }
  for (const x of [-4, 4]) {
    for (let z = -half; z <= half; z++) {
      for (let y = 1; y <= 12; y++) place(world, centerX + x, groundY + y, centerZ + z, y % 5 === 0 ? GOLD : DEEPSLATE_BRICKS);
    }
    place(world, centerX + x, groundY + 13, centerZ, LANTERN);
  }
  for (let z = -half; z <= half; z++) {
    for (let x = -4; x <= 4; x++) place(world, centerX + x, groundY + 13, centerZ + z, DEEPSLATE_BRICKS);
  }
  for (let x = -7; x <= 7; x += 2) {
    place(world, centerX + x, groundY + 14, centerZ - half, STONE_BRICKS);
    place(world, centerX + x, groundY + 14, centerZ + half, STONE_BRICKS);
  }
}

function templeRuins(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, GRASS);
  const levels = Math.max(3, Math.min(6, Math.floor(ctx.radius / 3)));
  for (let level = 0; level < levels; level++) {
    const radius = Math.max(2, ctx.radius - level * 2);
    const y = groundY + 1 + level * 3;
    for (let z = -radius; z <= radius; z++) {
      for (let x = -radius; x <= radius; x++) {
        if (Math.abs(x) + Math.abs(z) > radius + 2) continue;
        place(world, centerX + x, y, centerZ + z, level % 2 === 0 ? STONE_BRICKS : MOSSY);
        if (level < levels - 1 && (Math.abs(x) === radius || Math.abs(z) === radius)) {
          place(world, centerX + x, y + 1, centerZ + z, MOSSY);
        }
      }
    }
  }
  const topY = groundY + 1 + levels * 3;
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      if (Math.abs(x) + Math.abs(z) > 4) continue;
      place(world, centerX + x, topY, centerZ + z, STONE_BRICKS);
    }
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = centerX + Math.round(Math.cos(angle) * (ctx.radius - 2));
    const z = centerZ + Math.round(Math.sin(angle) * (ctx.radius - 2));
    const height = rng.int(3, 11);
    for (let y = 1; y <= height; y++) {
      place(world, x, groundY + y, z, MOSSY);
      if (y === height) place(world, x, groundY + y, z, y % 2 === 0 ? STONE_BRICKS : AIR);
    }
  }
  // Central stair and altar.
  for (let z = ctx.radius - 1; z >= 2; z--) {
    const step = Math.max(0, Math.min(levels - 1, Math.floor((ctx.radius - z) / 2)));
    place(world, centerX, groundY + 1 + step, centerZ + z, STONE_BRICKS);
  }
  place(world, centerX, topY + 1, centerZ, GOLD);
  place(world, centerX, topY + 2, centerZ, "minecraft:chiseled_stone_bricks");
  for (let i = 0; i < 5; i++) {
    const x = centerX + rng.int(-ctx.radius + 2, ctx.radius - 2);
    const z = centerZ + rng.int(-ctx.radius + 2, ctx.radius - 2);
    for (let y = 1; y <= rng.int(2, 5); y++) setIfAir(world, x, groundY + y, z, OAK_LEAVES);
  }
}

function monastery(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, GRASS, COBBLE);
  const radius = Math.max(6, ctx.radius - 1);
  for (let level = 0; level < 3; level++) {
    const rr = radius - level * 3;
    if (rr < 3) break;
    for (let z = -rr; z <= rr; z++) {
      for (let x = -rr; x <= rr; x++) {
        if (Math.abs(x) + Math.abs(z) > rr + 3) continue;
        place(world, centerX + x, groundY + 1 + level * 3, centerZ + z, level === 2 ? "minecraft:calcite" : STONE_BRICKS);
      }
    }
  }
  const base = groundY + 1;
  // Cloister wings around a courtyard.
  for (const [ox, oz, w, d] of [
    [-9, -4, 6, 8],
    [3, -4, 6, 8],
    [-3, -9, 6, 5],
    [-3, 4, 6, 5],
  ]) {
    for (let z = 0; z < d; z++) {
      for (let x = 0; x < w; x++) {
        for (let y = 0; y <= 4; y++) {
          const edge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
          if (!edge) continue;
          place(world, centerX + ox + x, base + y, centerZ + oz + z, y < 3 ? "minecraft:calcite" : DARK_OAK_LOG);
        }
      }
    }
    for (let z = 0; z < d; z++) {
      for (let x = 0; x < w; x++) {
        place(world, centerX + ox + x, base + 5, centerZ + oz + z, "minecraft:deepslate_tiles");
      }
    }
  }
  // Central temple and golden finial.
  for (let z = -2; z <= 2; z++) {
    for (let x = -2; x <= 2; x++) {
      for (let y = 0; y <= 6; y++) place(world, centerX + x, base + y, centerZ + z, y === 6 ? DARK_OAK_LOG : "minecraft:calcite");
    }
  }
  place(world, centerX, base + 7, centerZ, GOLD);
  place(world, centerX, base + 8, centerZ, GOLD);
  for (let i = 0; i < 10; i++) {
    const x = centerX + rng.int(-radius, radius);
    const z = centerZ + rng.int(-radius, radius);
    place(world, x, base + 1, z, LANTERN);
  }
}

function volcano(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  const radius = Math.max(8, Math.min(22, ctx.radius));
  const height = Math.max(18, Math.min(34, radius + 10));
  for (let y = 0; y <= height; y++) {
    const rr = Math.round(radius * (1 - y / height));
    for (let z = -rr; z <= rr; z++) {
      for (let x = -rr; x <= rr; x++) {
        if (x * x + z * z > rr * rr) continue;
        const block = y > height - 5 ? (rng.chance(0.15) ? MAGMA : BLACKSTONE) : y % 5 === 0 ? BASALT : BLACKSTONE;
        place(world, centerX + x, groundY + 1 + y, centerZ + z, block);
      }
    }
  }
  const crater = 3;
  for (let z = -crater; z <= crater; z++) {
    for (let x = -crater; x <= crater; x++) {
      if (x * x + z * z > crater * crater) continue;
      place(world, centerX + x, groundY + height, centerZ + z, LAVA);
      place(world, centerX + x, groundY + height - 1, centerZ + z, MAGMA);
    }
  }
  // Lava runnels down the cone.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    for (let r = crater; r < radius; r++) {
      const x = centerX + Math.round(Math.cos(angle) * r);
      const z = centerZ + Math.round(Math.sin(angle) * r);
      const y = groundY + 1 + Math.round(height * (1 - r / radius));
      place(world, x, y + 1, z, rng.chance(0.4) ? LAVA : OBSIDIAN);
    }
  }
}

function lavaChannels(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY } = ctx;
  pad(ctx, groundY + 1, BLACKSTONE);
  for (let z = -ctx.radius; z <= ctx.radius; z += 3) {
    for (let x = -ctx.radius + 2; x <= ctx.radius - 2; x++) {
      place(world, centerX + x, groundY + 1, centerZ + z, LAVA);
      place(world, centerX + x, groundY, centerZ + z, OBSIDIAN);
    }
    for (const x of [-ctx.radius + 1, ctx.radius - 1]) {
      place(world, centerX + x, groundY + 2, centerZ + z, OBSIDIAN);
    }
  }
  // Bridges over the channels.
  for (let z = -ctx.radius + 2; z <= ctx.radius - 2; z++) {
    for (let x = -3; x <= 3; x++) place(world, centerX + x, groundY + 2, centerZ + z, DEEPSLATE_BRICKS);
  }
  for (const x of [-3, 3]) {
    for (let z = -ctx.radius; z < ctx.radius; z += 4) {
      place(world, centerX + x, groundY + 3, centerZ + z, LANTERN);
    }
  }
}

function crystalCavern(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, DEEPSLATE);
  const radius = Math.max(7, Math.min(18, ctx.radius));
  const height = Math.max(16, Math.min(30, radius + 10));
  // Hollow geode: outer deepslate shell, amethyst lining, open arch toward the city.
  for (let y = 0; y <= height; y++) {
    const rr = Math.max(1, Math.round(radius * Math.sqrt(Math.max(0, 1 - ((y - height / 2) ** 2) / ((height / 2) ** 2)))));
    for (let z = -rr; z <= rr; z++) {
      for (let x = -rr; x <= rr; x++) {
        const d = Math.sqrt(x * x + z * z);
        if (d > rr) continue;
        if (d > rr - 2.5) place(world, centerX + x, groundY + 1 + y, centerZ + z, DEEPSLATE_BRICKS);
        else if (rng.chance(0.14)) place(world, centerX + x, groundY + 1 + y, centerZ + z, AMETHYST);
        else if (x >= rr - 3 && Math.abs(z) < 4) place(world, centerX + x, groundY + 1 + y, centerZ + z, AIR);
      }
    }
  }
  // Crystals and luminous pools inside.
  for (let i = 0; i < 12; i++) {
    const x = centerX + rng.int(-radius + 3, radius - 3);
    const z = centerZ + rng.int(-radius + 3, radius - 3);
    const h = rng.int(2, 8);
    for (let y = 1; y <= h; y++) place(world, x, groundY + y, z, y === h ? AMETHYST_BUD : AMETHYST);
  }
  for (let z = -3; z <= 3; z++) {
    for (let x = -3; x <= 3; x++) {
      if (x * x + z * z > 9) continue;
      place(world, centerX + x, groundY + 1, centerZ + z, WATER);
      place(world, centerX + x, groundY + 2, centerZ + z, SEA_LANTERN);
    }
  }
}

function oasis(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, SAND);
  const radius = Math.max(5, Math.min(12, ctx.radius - 1));
  for (let z = -radius; z <= radius; z++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + z * z > radius * radius) continue;
      place(world, centerX + x, groundY + 1, centerZ + z, WATER);
      place(world, centerX + x, groundY, centerZ + z, SANDSTONE);
    }
  }
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const distance = radius + rng.int(1, 4);
    const x = centerX + Math.round(Math.cos(angle) * distance);
    const z = centerZ + Math.round(Math.sin(angle) * distance);
    for (let y = 1; y <= 7; y++) place(world, x, groundY + y, z, JUNGLE_LOG);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx * dx + dz * dz > 4) continue;
        place(world, x + dx, groundY + 8, z + dz, JUNGLE_LEAVES);
      }
    }
  }
  // Shaded pavilion at the water's edge.
  const px = centerX + radius + 3;
  for (let z = -3; z <= 3; z++) {
    for (let x = 0; x <= 4; x++) {
      place(world, px + x, groundY + 1, centerZ + z, SANDSTONE);
    }
  }
  for (const [x, z] of [
    [0, -3],
    [4, -3],
    [0, 3],
    [4, 3],
  ]) {
    for (let y = 2; y <= 5; y++) place(world, px + x, groundY + y, centerZ + z, JUNGLE_LOG);
  }
  for (let z = -4; z <= 4; z++) {
    for (let x = -1; x <= 5; x++) place(world, px + x, groundY + 6, centerZ + z, "minecraft:smooth_sandstone");
  }
}

function canals(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, STONE_BRICKS);
  const radius = Math.max(5, ctx.radius - 1);
  for (let x = -radius; x <= radius; x++) {
    for (let z = -1; z <= 1; z++) {
      place(world, centerX + x, groundY + 1, centerZ + z, WATER);
      place(world, centerX + x, groundY, centerZ + z, STONE_BRICKS);
    }
  }
  for (let z = -radius; z <= radius; z++) {
    for (let x = -1; x <= 1; x++) {
      place(world, centerX + x, groundY + 1, centerZ + z, WATER);
    }
  }
  for (let x = -radius + 2; x <= radius - 2; x += 5) {
    for (let z = -3; z <= 3; z++) {
      place(world, centerX + x, groundY + 2, centerZ + z, x % 2 === 0 ? OAK : DARK_OAK);
    }
    for (const z of [-3, 3]) {
      place(world, centerX + x, groundY + 3, centerZ + z, LANTERN);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = centerX + rng.int(-radius + 3, radius - 3);
    const z = centerZ + rng.int(-radius + 3, radius - 3);
    place(world, x, groundY + 2, z, "minecraft:flower_pot");
  }
}

function smokestacks(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY } = ctx;
  pad(ctx, groundY + 1, "minecraft:stone", GRAVEL);
  const radius = Math.max(6, ctx.radius - 1);
  // Factory hall.
  for (let z = -4; z <= 4; z++) {
    for (let x = -radius; x <= radius; x++) {
      const roof = 6 + Math.round(Math.sin((x / radius) * Math.PI) * 3);
      for (let y = 0; y < roof; y++) {
        const edge = Math.abs(z) === 4 || x === -radius || x === radius;
        if (edge) place(world, centerX + x, groundY + 1 + y, centerZ + z, y > 3 ? BRICKS : STONE_BRICKS);
      }
      place(world, centerX + x, groundY + 1 + roof, centerZ + z, yRoof());
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = centerX - radius + 2 + i * Math.floor((radius * 2 - 4) / 2);
    const z = centerZ - 3 + i * 3;
    const height = 15 + i * 4;
    for (let y = 0; y <= height; y++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx * dx + dz * dz > 2) continue;
          const band = y % 5 === 0;
          place(world, x + dx, groundY + 1 + y, z + dz, band ? COPPER : BRICKS);
        }
      }
    }
    place(world, x, groundY + height + 2, z, AIR);
  }
  for (let x = -radius + 1; x <= radius - 1; x++) {
    for (let z = -3; z <= 3; z++) {
      if ((x + z) % 4 !== 0) continue;
      place(world, centerX + x, groundY + 1, centerZ + z, yIron(x, z));
    }
  }
}

function yRoof(): string {
  return "minecraft:deepslate_tiles";
}

function yIron(x: number, z: number): string {
  return (x + z) % 8 === 0 ? "minecraft:copper_block" : GRAVEL;
}

function terraces(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, GRASS);
  const levels = Math.max(2, Math.min(5, Math.floor(ctx.radius / 4)));
  const radius = Math.max(5, ctx.radius - 1);
  for (let level = 0; level < levels; level++) {
    const rr = radius - level * 2;
    if (rr < 2) break;
    const y = groundY + level * 2;
    for (let z = -rr; z <= rr; z++) {
      for (let x = -rr; x <= rr; x++) {
        if (Math.abs(x) + Math.abs(z) > rr + 2) continue;
        place(world, centerX + x, y, centerZ + z, level === 0 ? WATER : level % 2 === 0 ? GRASS : FARMLAND);
        if (level === 0) place(world, centerX + x, y - 1, centerZ + z, STONE_BRICKS);
      }
    }
    for (let x = -rr; x <= rr; x += 2) {
      place(world, centerX + x, y + 1, centerZ - rr, STONE_BRICKS);
      place(world, centerX + x, y + 1, centerZ + rr, STONE_BRICKS);
    }
    if (level > 0) {
      for (let i = 0; i < rr; i += 2) place(world, centerX + rng.int(-rr, rr), y + 1, centerZ + rng.int(-rr, rr), rng.chance(0.5) ? OAK_LEAVES : "minecraft:azure_bluet");
    }
  }
}

function ruins(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, GRASS);
  for (let i = 0; i < 6; i++) {
    const x = centerX + rng.int(-ctx.radius + 2, ctx.radius - 2);
    const z = centerZ + rng.int(-ctx.radius + 2, ctx.radius - 2);
    const height = rng.int(2, 10);
    for (let y = 1; y <= height; y++) {
      setIfAir(world, x, groundY + y, z, y === height && rng.chance(0.5) ? AIR : MOSSY);
    }
    if (rng.chance(0.5)) {
      for (let dx = 1; dx <= rng.int(2, 6); dx++) setIfAir(world, x + dx, groundY + height, z, MOSSY);
    }
  }
  for (let i = 0; i < 4; i++) {
    const z = centerZ - ctx.radius + i * 5;
    for (let x = -ctx.radius; x <= ctx.radius; x++) {
      if (rng.chance(0.7)) place(world, centerX + x, groundY + 1, z, rng.chance(0.5) ? MOSSY : STONE_BRICKS);
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = centerX + rng.int(-ctx.radius + 2, ctx.radius - 2);
    const z = centerZ + rng.int(-ctx.radius + 2, ctx.radius - 2);
    setIfAir(world, x, groundY + 2, z, OAK_LEAVES);
  }
}

function stoneCircle(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, GRASS);
  const radius = Math.max(4, ctx.radius - 2);
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const x = centerX + Math.round(Math.cos(angle) * radius);
    const z = centerZ + Math.round(Math.sin(angle) * radius);
    const height = rng.int(4, 9);
    for (let y = 1; y <= height; y++) place(world, x, groundY + y, z, y % 4 === 0 ? MOSSY : STONE_BRICKS);
    if (i % 2 === 0) {
      const nextAngle = ((i + 1) / 10) * Math.PI * 2;
      const nx = centerX + Math.round(Math.cos(nextAngle) * radius);
      const nz = centerZ + Math.round(Math.sin(nextAngle) * radius);
      for (let t = 1; t < 3; t++) {
        place(world, x + Math.round((nx - x) * (t / 3)), groundY + height + 1, z + Math.round((nz - z) * (t / 3)), STONE_BRICKS);
      }
    }
  }
  place(world, centerX, groundY + 1, centerZ, GOLD);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    place(world, centerX + Math.round(Math.cos(angle) * 2), groundY + 2, centerZ + Math.round(Math.sin(angle) * 2), AMETHYST_BUD);
  }
}

function waterfall(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY, rng } = ctx;
  pad(ctx, groundY + 1, GRASS);
  const radius = Math.max(5, ctx.radius - 1);
  const height = 16 + rng.int(0, 9);
  for (let z = -radius; z <= radius; z++) {
    for (let x = -radius; x <= radius; x++) {
      const r = Math.sqrt(x * x + z * z);
      if (r > radius) continue;
      const h = Math.round(height * Math.max(0.1, 1 - r / radius));
      for (let y = 1; y <= h; y++) {
        place(world, centerX + x, groundY + y, centerZ + z, y > h - 3 ? GRASS : y % 3 === 0 ? MOSSY : STONE);
      }
    }
  }
  for (let y = groundY + 1; y <= groundY + height; y++) {
    place(world, centerX, y, centerZ + radius, WATER);
    if (y % 4 === 0) place(world, centerX, y, centerZ + radius - 1, WATER);
  }
  for (let z = centerZ + radius - 2; z <= centerZ + radius + 3; z++) {
    for (let x = centerX - 3; x <= centerX + 3; x++) place(world, x, groundY + 1, z, WATER);
  }
  for (let i = 0; i < 8; i++) {
    const x = centerX + rng.int(-radius + 2, radius - 2);
    const z = centerZ + rng.int(-radius + 2, radius - 2);
    setIfAir(world, x, groundY + 2, z, OAK_LEAVES);
  }
}

function windmill(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY } = ctx;
  pad(ctx, groundY + 1, GRASS);
  const height = 14;
  for (let y = 0; y <= height; y++) {
    const radius = y < height - 3 ? 3 : 2;
    cylinder(world, centerX, centerZ, groundY + 1 + y, groundY + 1 + y, radius, y % 4 === 0 ? STONE_BRICKS : WHITE_WOOL);
  }
  for (let y = 1; y <= 3; y++) {
    for (let z = -1; z <= 1; z++) place(world, centerX + 3, groundY + 2 + y, centerZ + z, DARK_OAK);
  }
  for (let y = groundY + 2; y <= groundY + 5; y++) place(world, centerX, y, centerZ + 3, DARK_OAK);
  const hubY = groundY + 12;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    for (let r = 1; r <= 7; r++) {
      const x = centerX + Math.round(Math.cos(angle) * r);
      const y = hubY + Math.round(Math.sin(angle) * r);
      place(world, x, y, centerZ, r % 3 === 0 ? DARK_OAK : WHITE_WOOL);
    }
  }
  place(world, centerX, hubY, centerZ, GOLD);
  place(world, centerX, groundY + height + 2, centerZ, "minecraft:lantern");
}

function skyBridges(ctx: FeatureContext): void {
  const { world, centerX, centerZ, groundY } = ctx;
  pad(ctx, Math.max(8, groundY), "minecraft:white_wool");
  const height = 24;
  const span = Math.max(6, ctx.radius - 2);
  for (const x of [centerX - span + 2, centerX + span - 2]) {
    for (let y = 0; y <= height; y++) {
      for (let z = -2; z <= 2; z++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + z * z > 5) continue;
          place(world, x + dx, groundY + 1 + y, centerZ + z, y % 5 === 0 ? GOLD : WHITE_WOOL);
        }
      }
    }
    place(world, x, groundY + height + 2, centerZ, GLOWSTONE);
  }
  for (let x = centerX - span + 2; x <= centerX + span - 2; x++) {
    for (let z = -2; z <= 2; z++) {
      place(world, x, groundY + height, centerZ + z, x % 3 === 0 ? DARK_OAK : OAK);
      if (Math.abs(z) === 2) {
        place(world, x, groundY + height + 1, centerZ + z, DARK_OAK_LOG);
        if (x % 4 === 0) place(world, x, groundY + height + 2, centerZ + z, LANTERN);
      }
    }
  }
  // Hanging chains suggest suspension without loading external assets.
  for (let x = centerX - span + 3; x <= centerX + span - 3; x += 4) {
    for (let y = groundY + height - 4; y < groundY + height; y++) {
      place(world, x, y, centerZ - 2, "minecraft:chain");
      place(world, x, y, centerZ + 2, "minecraft:chain");
    }
  }
}

export function clearSiteFeatureFootprint(
  world: VoxelWorld,
  layout: SiteLayout,
  site: WorldSiteDefinition,
): void {
  // Reserved for future site-feature collision diagnostics; kept side-effect free.
  void world;
  void layout;
  void site;
}

export function featureUsesWater(kind: OuterFeatureKind): boolean {
  return kind === "pirate-ship" || kind === "harbor" || kind === "oasis" || kind === "waterfall" || kind === "canals";
}

export function featureUsesLava(kind: OuterFeatureKind): boolean {
  return kind === "volcano" || kind === "lava-channels";
}

export function featureIsSkyborne(kind: OuterFeatureKind): boolean {
  return kind === "sky-islands" || kind === "sky-bridges";
}

export function featureSiteHeight(ctx: { groundY: number }): number {
  return ctx.groundY;
}
