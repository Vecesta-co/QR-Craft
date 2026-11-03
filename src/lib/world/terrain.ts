import { VoxelWorld } from "@/lib/world/VoxelWorld";
import type { SiteLayout } from "@/lib/world/site";
import { insideRect, type Rect } from "@/lib/world/site";
import type { Complexity } from "@/lib/world/site";
import { createRng, fbm2D, hash3 } from "@/lib/world/rng";
import type { SiteTerrainRules, VegetationKind, WorldSiteDefinition } from "@/lib/sites/types";
import { buildSiteFeatures, planSiteFeatures } from "@/lib/world/site-features";

const AIR = "minecraft:air";
const STONE = "minecraft:stone";
const DEEPSLATE = "minecraft:deepslate";
const DIRT = "minecraft:dirt";
const GRASS = "minecraft:grass_block";
const GRAVEL = "minecraft:gravel";
const SAND = "minecraft:sand";
const WATER = "minecraft:water";
const STONE_BRICKS = "minecraft:stone_bricks";
const COBBLE = "minecraft:cobblestone";
const DEEPSLATE_BRICKS = "minecraft:deepslate_bricks";
const POLISHED_DIORITE = "minecraft:polished_diorite";
const CALCITE = "minecraft:calcite";
const WHITE_CONCRETE = "minecraft:white_concrete";
const OAK_LOG = "minecraft:oak_log";
const OAK_PLANKS = "minecraft:oak_planks";
const SPRUCE_PLANKS = "minecraft:spruce_planks";
const DARK_OAK = "minecraft:dark_oak_planks";
const OAK_LEAVES = "minecraft:oak_leaves";
const SPRUCE_LEAVES = "minecraft:spruce_leaves";
const GLOWSTONE = "minecraft:glowstone";
const HAY = "minecraft:hay_block";
const WHEAT = "minecraft:wheat";
const SPRUCE_LOG = "minecraft:spruce_log";
const SANDSTONE = "minecraft:sandstone";
const MOSSY = "minecraft:mossy_stone_bricks";
const IRON = "minecraft:iron_block";

export interface TerrainResult {
  world: VoxelWorld;
  fieldRects: Rect[];
  hasHamlet: boolean;
  heights: Int16Array;
  features: string[];
}

interface Protection {
  road: Rect;
  fields: Rect[];
  hamlet: Rect | null;
  features: Rect[];
}

export function generateTerrain(
  layout: SiteLayout,
  seed: number,
  complexity: Complexity,
  site?: WorldSiteDefinition,
): TerrainResult {
  const world = new VoxelWorld(layout.worldSize, layout.worldHeight, layout.worldSize);
  const size = layout.worldSize;
  const heights = new Int16Array(size * size);
  const plateau = layout.plateauRect;
  const moat = layout.moatRect;
  const profile = site && !site.legacy ? site.terrain : null;
  const roadHalf = 4;

  // Base landscape heightmap. Legacy sites keep the original valley profile
  // byte-for-byte; new sites receive a profile-specific relief function.
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const nearPlateau = x > plateau.x1 - 10 && x < plateau.x2 + 10 && z > plateau.z1 - 10 && z < plateau.z2 + 10;
      const distanceFromMoat = Math.min(
        Math.abs(x - moat.x1),
        Math.abs(x - moat.x2),
        Math.abs(z - moat.z1),
        Math.abs(z - moat.z2),
      );
      const noise = fbm2D(x / 42, z / 42, seed + 71, 3);
      let h = profile
        ? profiledHeight(profile, x, z, size, seed, noise)
        : 17 + Math.floor(noise * 6);
      if (nearPlateau || distanceFromMoat < 5) h = Math.min(h, 19);
      if (h < 6) h = 6;
      heights[z * size + x] = h;
    }
  }

  // Fill the landscape.
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const h = heights[z * size + x];
      const beach = h <= 18;
      const surface = profile ? siteSurface(profile, h, beach) : beach ? SAND : GRASS;
      const subsurface = profile ? profile.subsurface : beach ? SANDSTONE : DIRT;
      const stone = profile ? profile.stone : yStone(h);
      for (let y = 0; y <= h; y++) {
        let block: string;
        if (y === h) block = surface;
        else if (y >= h - 3) block = subsurface;
        else block = stone;
        world.set(x, y, z, block);
      }
    }
  }

  if (profile && profile.fluid !== "none" && profile.profile !== "sky") {
    fillProfileWater(world, layout, heights, profile);
  }

  buildPlateau(world, layout, seed);
  buildMoat(world, layout, seed, profile?.fluid ?? "water");
  buildBridgeAndRoad(world, layout, seed, heights);

  const supportsFields =
    !profile ||
    ["valley", "river", "garden", "snow", "fungal", "desert"].includes(profile.profile);
  const supportsHamlet =
    !profile ||
    ["valley", "river", "garden", "snow", "desert", "plateau"].includes(profile.profile);
  const featurePlan = site ? planSiteFeatures(layout, site) : [];
  const featureAreas = featurePlan.map((entry) => entry.rect);
  const fields = supportsFields
    ? buildFields(world, layout, heights, seed, complexity, featureAreas)
    : [];
  const hamlet = supportsHamlet ? buildHamlet(world, layout, heights, seed, featureAreas) : null;

  const featureResult = site
    ? buildSiteFeatures(world, layout, site, heights, seed)
    : { names: [], rects: [] };

  const protection: Protection = {
    road: {
      x1: layout.centerX - roadHalf - 4,
      x2: layout.centerX + roadHalf + 4,
      z1: moat.z2 - 4,
      z2: size - 1,
    },
    fields,
    hamlet,
    features: featureResult.rects,
  };

  const scatterProfile = profile ?? undefined;
  scatterTrees(world, layout, heights, seed, complexity, protection, scatterProfile);
  scatterRocksAndBushes(world, layout, heights, seed, complexity, protection, scatterProfile);
  if (!profile || ["valley", "river", "garden", "snow"].includes(profile.profile)) {
    decorateRoadside(world, layout, heights, seed);
  }

  return {
    world,
    fieldRects: fields,
    hasHamlet: hamlet !== null,
    heights,
    features: featureResult.names,
  };
}

function yStone(h: number): string {
  return h < 10 ? STONE : DEEPSLATE;
}

function profiledHeight(
  profile: SiteTerrainRules,
  x: number,
  z: number,
  size: number,
  seed: number,
  noise: number,
): number {
  const relief = profile.relief;
  const ridge = 1 - Math.abs(fbm2D(x / 64, z / 64, seed + 917, 4) * 2 - 1);
  const fine = fbm2D(x / 13, z / 13, seed + 443, 2);
  switch (profile.profile) {
    case "alpine":
    case "highland":
      return 17 + Math.floor(ridge * relief + noise * 3);
    case "mountain":
      return 18 + Math.floor(ridge * relief + noise * 2);
    case "coastal":
    case "tropical": {
      const edge = Math.min(x, z, size - 1 - x, size - 1 - z);
      const shore = Math.max(0, 1 - edge / Math.max(12, size * 0.18));
      return Math.floor(18 - shore * 8 + noise * 4);
    }
    case "river": {
      const channel = Math.abs(x - size * 0.22) < size * 0.05 ? 5 : 0;
      return 17 + Math.floor(noise * 4 - channel);
    }
    case "cavern":
      return 15 + Math.floor(noise * 3);
    case "sky":
      return 12 + Math.floor(noise * 2);
    case "fungal":
    case "forest":
    case "garden":
      return 16 + Math.floor(noise * relief * 0.55 + fine * 2);
    case "volcanic":
      return 17 + Math.floor(ridge * relief * 0.65 + fine * 3);
    case "desert":
      return 17 + Math.floor(fine * relief * 0.7);
    case "snow":
      return 16 + Math.floor(noise * relief * 0.6);
    case "jungle":
      return 16 + Math.floor(noise * relief * 0.75);
    case "industrial":
      return 17 + Math.floor(noise * relief * 0.25);
    case "ruins":
      return 16 + Math.floor(noise * relief * 0.7);
    case "plateau":
      return 17 + Math.floor(noise * relief * 0.4);
    case "oasis":
      return 16 + Math.floor(fine * relief * 0.55);
    default:
      return 17 + Math.floor(noise * 6);
  }
}

function siteSurface(profile: SiteTerrainRules, h: number, beach: boolean): string {
  if (profile.snowLine !== undefined && h >= profile.snowLine) return "minecraft:snow_block";
  if (beach && profile.beach) return profile.beach;
  if (beach && profile.profile === "coastal") return "minecraft:sand";
  return profile.surface;
}

/**
 * Fills genuine low ground outside the city terrace and moat. Coastal and
 * tropical profiles therefore have open water and a shoreline instead of only
 * the decorative moat. The city plateau, bridge corridor and sky islands stay
 * dry because they are built afterwards or excluded here.
 */
function fillProfileWater(
  world: VoxelWorld,
  layout: SiteLayout,
  heights: Int16Array,
  profile: SiteTerrainRules,
): void {
  const size = layout.worldSize;
  const level = profile.waterLevel;
  const bed =
    profile.fluid === "lava"
      ? "minecraft:magma_block"
      : profile.profile === "snow"
        ? GRAVEL
        : profile.beach ?? SAND;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (insideRect(x, z, layout.plateauRect) || insideRect(x, z, layout.moatRect)) continue;
      const h = heights[z * size + x];
      if (h >= level) continue;
      world.set(x, h, z, bed);
      for (let y = h + 1; y <= level; y++) {
        if (profile.fluid === "lava") {
          world.set(x, y, z, "minecraft:lava");
        } else if (profile.profile === "snow" && y === level) {
          world.set(x, y, z, "minecraft:ice");
        } else {
          world.set(x, y, z, WATER);
        }
      }
    }
  }
}

function buildPlateau(world: VoxelWorld, layout: SiteLayout, seed: number): void {
  const { plateauRect, cityRect, plateauTopY, cityGroundY } = layout;
  for (let z = plateauRect.z1; z <= plateauRect.z2; z++) {
    for (let x = plateauRect.x1; x <= plateauRect.x2; x++) {
      for (let y = 0; y < plateauTopY; y++) {
        const depth = plateauTopY - y;
        const block = depth <= 2 ? STONE_BRICKS : y < 8 ? STONE : DEEPSLATE;
        world.set(x, y, z, block);
      }
      world.set(x, plateauTopY, z, STONE_BRICKS);

      if (!insideRect(x, z, cityRect)) {
        // Raised pale esplanade around the construction site.
        const band = (x + z + seed) % 17;
        const paving = band < 3 ? CALCITE : band < 6 ? POLISHED_DIORITE : WHITE_CONCRETE;
        world.set(x, cityGroundY, z, paving);
      }
    }
  }

  // Parapet around the plateau, with a gate at the south bridge.
  const gateHalf = Math.floor(layout.bridgeWidth / 2);
  for (let x = plateauRect.x1; x <= plateauRect.x2; x++) {
    for (const z of [plateauRect.z1, plateauRect.z2]) {
      const southGate = z === plateauRect.z2 && Math.abs(x - layout.centerX) <= gateHalf;
      if (southGate) continue;
      world.set(x, cityGroundY + 1, z, STONE_BRICKS);
      if ((x + z) % 3 !== 0) world.set(x, cityGroundY + 2, z, STONE_BRICKS);
    }
  }
  for (let z = plateauRect.z1; z <= plateauRect.z2; z++) {
    for (const x of [plateauRect.x1, plateauRect.x2]) {
      world.set(x, cityGroundY + 1, z, STONE_BRICKS);
      if ((x + z) % 3 !== 0) world.set(x, cityGroundY + 2, z, STONE_BRICKS);
    }
  }

  // Corner bastions give the terrace a fortified silhouette.
  for (const [cx, cz] of [
    [plateauRect.x1, plateauRect.z1],
    [plateauRect.x2, plateauRect.z1],
    [plateauRect.x1, plateauRect.z2],
    [plateauRect.x2, plateauRect.z2],
  ]) {
    for (let y = cityGroundY + 1; y <= cityGroundY + 5; y++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const x = cx + dx;
          const z = cz + dz;
          if (!insideRect(x, z, plateauRect)) continue;
          world.set(x, y, z, (x + y + z) % 5 === 0 ? MOSSY : STONE_BRICKS);
        }
      }
    }
    world.set(cx, cityGroundY + 6, cz, DEEPSLATE_BRICKS);
  }
}

function buildMoat(
  world: VoxelWorld,
  layout: SiteLayout,
  seed: number,
  fluid: "water" | "lava" | "none",
): void {
  const { moatRect, plateauRect, waterY } = layout;
  for (let z = moatRect.z1; z <= moatRect.z2; z++) {
    for (let x = moatRect.x1; x <= moatRect.x2; x++) {
      if (insideRect(x, z, plateauRect)) continue;
      for (let y = 0; y < waterY; y++) {
        world.set(x, y, z, y < 12 ? STONE : y < waterY - 1 ? GRAVEL : SAND);
      }
      if (fluid === "water") {
        world.set(x, waterY, z, WATER);
        if (hash3(x, waterY, z, seed) > 0.988) world.set(x, waterY + 1, z, "minecraft:sea_lantern");
      } else if (fluid === "lava") {
        world.set(x, waterY, z, "minecraft:lava");
        if (hash3(x, waterY, z, seed) > 0.985) world.set(x, waterY + 1, z, "minecraft:magma_block");
      } else {
        world.set(x, waterY, z, GRAVEL);
      }
      // The landscape was filled before the moat was dug; clear it above the
      // waterline so the ditch is actually open to the sky.
      for (let y = waterY + 1; y < world.sizeY; y++) world.set(x, y, z, AIR);
    }
  }
}

function buildBridgeAndRoad(
  world: VoxelWorld,
  layout: SiteLayout,
  seed: number,
  heights: Int16Array,
): void {
  const size = layout.worldSize;
  const cx = layout.centerX;
  const half = Math.floor(layout.bridgeWidth / 2);
  const startZ = layout.plateauRect.z2;
  const endZ = layout.moatRect.z2 + 1;
  const deckY = layout.bridgeY;

  // Bridge deck and railings.
  for (let z = startZ; z <= endZ; z++) {
    for (let x = cx - half; x <= cx + half; x++) {
      world.set(x, deckY, z, (x + z) % 4 === 0 ? STONE_BRICKS : STONE);
      if (x === cx - half || x === cx + half) {
        world.set(x, deckY + 1, z, STONE_BRICKS);
      }
    }
  }
  for (let z = endZ + 1; z < size; z++) {
    for (let x = cx - half; x <= cx + half; x++) {
      const edge = x === cx - half || x === cx + half;
      const roadBlock = edge ? STONE_BRICKS : (x + z) % 7 === 0 ? COBBLE : GRAVEL;
      world.set(x, deckY, z, roadBlock);
      heights[z * size + x] = deckY;
      for (let y = 0; y < deckY; y++) {
        if (y === deckY - 1) world.set(x, y, z, DIRT);
        else if (world.get(x, y, z) === AIR) world.set(x, y, z, STONE);
      }
    }
    // Embankment shoulders.
    for (const x of [cx - half - 1, cx + half + 1]) {
      if (x < 0 || x >= size) continue;
      world.set(x, deckY - 1, z, STONE_BRICKS);
      heights[z * size + x] = Math.max(heights[z * size + x], deckY - 1);
    }
  }

  // Bridge supports.
  for (let z = startZ + 2; z <= endZ; z += 4) {
    for (const x of [cx - half + 1, cx + half - 1]) {
      for (let y = layout.waterY; y < deckY; y++) {
        world.set(x, y, z, y < 14 ? STONE : STONE_BRICKS);
      }
    }
  }

  // Lamps along the approach.
  for (let z = endZ + 8; z < size - 4; z += 16) {
    for (const x of [cx - half - 3, cx + half + 3]) {
      if (x < 1 || x >= size - 1) continue;
      const ground = heights[z * size + x];
      for (let y = ground + 1; y <= ground + 2; y++) world.set(x, y, z, STONE_BRICKS);
      world.set(x, ground + 3, z, GLOWSTONE);
      world.set(x, ground, z, COBBLE);
    }
  }

  // Bridge gate lamps.
  for (const x of [cx - half - 1, cx + half + 1]) {
    world.set(x, deckY + 3, startZ - 1, GLOWSTONE);
    world.set(x, deckY + 2, startZ - 1, STONE_BRICKS);
    world.set(x, deckY + 1, startZ - 1, STONE_BRICKS);
  }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.z1 <= b.z2 && a.z2 >= b.z1;
}

function buildFields(
  world: VoxelWorld,
  layout: SiteLayout,
  heights: Int16Array,
  seed: number,
  complexity: Complexity,
  exclusions: readonly Rect[] = [],
): Rect[] {
  const size = layout.worldSize;
  const moat = layout.moatRect;
  const fields: Rect[] = [];
  const margin = Math.min(moat.x1, size - 1 - moat.x2);
  const width = Math.min(Math.floor(size * 0.075), margin - 6);
  const depth = Math.floor(width * 0.7);
  if (width < 7 || depth < 5) return fields;

  const spots: Array<[number, number]> = [
    [Math.floor((moat.x2 + size - 1) / 2), Math.floor(size * 0.18)],
    [Math.floor((moat.x1 - 1) / 2), Math.floor(size * 0.3)],
  ];
  const count = complexity === "serene" ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const [cx, cz] = spots[i];
    const area: Rect = {
      x1: Math.max(4, cx - Math.floor(width / 2)),
      x2: Math.min(size - 6, cx + Math.floor(width / 2)),
      z1: Math.max(4, cz - depth),
      z2: Math.min(size - 6, cz + depth),
    };
    if (area.x2 - area.x1 < 6 || area.z2 - area.z1 < 4) continue;
    if (rectsOverlap(area, moat)) continue;
    if (exclusions.some((excluded) => rectsOverlap(area, excluded))) continue;
    if (fields.some((field) => rectsOverlap(field, area))) continue;

    const centerRow = Math.floor((area.z1 + area.z2) / 2);
    const centerCol = Math.floor((area.x1 + area.x2) / 2);
    const h = Math.max(17, heights[centerRow * size + centerCol] ?? 18) + 1;
    for (let z = area.z1; z <= area.z2; z++) {
      for (let x = area.x1; x <= area.x2; x++) {
        const border = x === area.x1 || x === area.x2 || z === area.z1 || z === area.z2;
        for (let y = 0; y < h; y++) {
          world.set(x, y, z, y === h - 1 ? (border ? GRAVEL : DIRT) : STONE);
        }
        if (border) {
          world.set(x, h, z, COBBLE);
        } else if ((z - area.z1) % 3 !== 0) {
          const crop = hash3(x, h, z, seed) > 0.35 ? WHEAT : HAY;
          world.set(x, h, z, crop);
        }
        heights[z * size + x] = h;
      }
    }
    // Hay bales in the corners.
    for (const [hx, hz] of [
      [area.x1 + 1, area.z1 + 1],
      [area.x2 - 1, area.z2 - 1],
    ]) {
      world.set(hx, h + 1, hz, HAY);
    }
    fields.push(area);
  }
  return fields;
}

function buildHamlet(
  world: VoxelWorld,
  layout: SiteLayout,
  heights: Int16Array,
  seed: number,
  exclusions: readonly Rect[] = [],
): Rect | null {
  const size = layout.worldSize;
  const rng = createRng(seed ^ 0xc0ffee);
  const baseX = Math.min(size - 18, Math.max(layout.moatRect.x2 + 10, Math.floor(size * 0.22)));
  const baseZ = Math.min(size - 16, layout.moatRect.z2 + Math.floor(size * 0.12));
  const area: Rect = { x1: baseX - 5, z1: baseZ - 4, x2: baseX + 14, z2: baseZ + 12 };
  // The hamlet only exists when there is a real band of land beyond the moat.
  if (
    area.x1 <= layout.moatRect.x2 + 1 ||
    area.z1 <= layout.moatRect.z2 + 1 ||
    area.x2 > size - 4 ||
    area.z2 > size - 4
  ) {
    return null;
  }
  if (exclusions.some((excluded) => rectsOverlap(area, excluded))) return null;
  const flat = 19;
  for (let z = area.z1; z <= area.z2; z++) {
    for (let x = area.x1; x <= area.x2; x++) {
      for (let y = 0; y < flat; y++) {
        world.set(x, y, z, y === flat - 1 ? GRASS : y > flat - 4 ? DIRT : STONE);
      }
      heights[z * size + x] = flat - 1;
    }
  }
  const cottages: Array<[number, number, number]> = [
    [baseX, baseZ, 7],
    [baseX + 8, baseZ + 6, 6],
  ];
  for (const [x, z, width] of cottages) {
    buildCottage(world, x, z, flat, width, rng);
  }
  // A little well and hay stack.
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      world.set(baseX + 5 + dx, flat, baseZ + 3 + dz, COBBLE);
    }
  }
  world.set(baseX + 5, flat + 1, baseZ + 3, WATER);
  world.set(baseX + 5, flat + 2, baseZ + 3, AIR);
  for (let y = 0; y < 2; y++) {
    world.set(baseX + 13, flat + y, baseZ + 2, HAY);
  }
  return area;
}

function buildCottage(
  world: VoxelWorld,
  x: number,
  z: number,
  ground: number,
  width: number,
  rng: ReturnType<typeof createRng>,
): void {
  const depth = Math.max(5, width - 1);
  for (let dz = 0; dz < depth; dz++) {
    for (let dx = 0; dx < width; dx++) {
      world.set(x + dx, ground, z + dz, COBBLE);
      for (let y = ground + 1; y <= ground + 3; y++) {
        const edge = dx === 0 || dz === 0 || dx === width - 1 || dz === depth - 1;
        if (!edge) continue;
        let block = (dx + dz) % 4 === 0 ? OAK_LOG : OAK_PLANKS;
        if (dz === 0 && dx === Math.floor(width / 2)) block = DARK_OAK;
        if ((dz === 0 || dz === depth - 1) && (dx === 1 || dx === width - 2)) block = GLOWSTONE;
        world.set(x + dx, y, z + dz, block);
      }
    }
  }
  // Gabled roof along Z.
  for (let layer = 0; layer <= Math.floor(width / 2); layer++) {
    const y = ground + 4 + layer;
    const from = layer;
    const to = width - 1 - layer;
    if (from > to) break;
    for (let dz = -1; dz <= depth; dz++) {
      for (let dx = from; dx <= to; dx++) {
        world.set(x + dx, y, z + dz, SPRUCE_PLANKS);
      }
    }
  }
  // Chimney.
  const chimneyX = x + width - 2;
  const chimneyZ = z + 1;
  for (let y = ground + 4; y <= ground + 4 + Math.floor(width / 2) + 2; y++) {
    if (rng.chance(0.8)) world.set(chimneyX, y, chimneyZ, COBBLE);
  }
  world.set(chimneyX, ground + 4 + Math.floor(width / 2) + 3, chimneyZ, AIR);
}

function scatterTrees(
  world: VoxelWorld,
  layout: SiteLayout,
  heights: Int16Array,
  seed: number,
  complexity: Complexity,
  protection: Protection,
  profile?: SiteTerrainRules,
): void {
  const size = layout.worldSize;
  const rng = createRng(seed ^ 0x7ee5);
  const density = profile ? profile.vegetationDensity : 1;
  const baseDivisor = complexity === "dense" ? 420 : complexity === "serene" ? 800 : 570;
  const target = Math.floor(((size * size) / baseDivisor) * density);
  if (profile && profile.vegetation === "none") return;
  let placed = 0;
  let attempts = 0;
  while (placed < target && attempts < target * 30) {
    attempts++;
    const x = rng.int(5, size - 6);
    const z = rng.int(5, size - 6);
    if (insideRect(x, z, layout.moatRect)) continue;
    if (insideRect(x, z, expand(protection.road, 3))) continue;
    if (protection.fields.some((field) => insideRect(x, z, expand(field, 3)))) continue;
    if (protection.hamlet && insideRect(x, z, expand(protection.hamlet, 3))) continue;
    if (protection.features.some((feature) => insideRect(x, z, expand(feature, 2)))) continue;
    const h = heights[z * size + x];
    if (h < 8 || h > 56) continue;
    const surface = world.get(x, h, z);
    if (surface === AIR || surface === WATER || surface === "minecraft:lava") continue;
    if (profile) {
      if (surface !== profile.surface && surface !== "minecraft:snow_block" && surface !== profile.beach) continue;
    } else if (surface !== GRASS) {
      continue;
    }
    if (rng.chance(profile && profile.vegetation === "dead" ? 0.9 : 0.3)) continue;
    const kind = profile ? profile.vegetation : rng.chance(0.68) ? "oak" : "spruce";
    placeTree(world, x, h + 1, z, kind, rng);
    placed++;
  }
}

function placeTree(
  world: VoxelWorld,
  x: number,
  y: number,
  z: number,
  kind: VegetationKind,
  rng: ReturnType<typeof createRng>,
): void {
  if (kind === "none") return;
  if (kind === "mushroom") {
    const trunk = rng.int(4, 8);
    const cap = rng.chance(0.5) ? "minecraft:red_mushroom_block" : "minecraft:brown_mushroom_block";
    for (let i = 0; i < trunk; i++) world.set(x, y + i, z, "minecraft:mushroom_stem");
    const top = y + trunk;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) > 3) continue;
        if (rng.chance(0.12)) continue;
        world.set(x + dx, top, z + dz, cap);
      }
    }
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      world.set(x + dx, top - 1, z + dz, "minecraft:shroomlight");
    }
    world.set(x, top + 1, z, cap);
    return;
  }
  if (kind === "crystal") {
    const height = rng.int(3, 8);
    const base = rng.chance(0.5) ? "minecraft:amethyst_block" : "minecraft:budding_amethyst";
    for (let i = 0; i < height; i++) {
      const taper = i > height - 3;
      world.set(x, y + i, z, taper ? "minecraft:large_amethyst_bud" : base);
    }
    world.set(x, y + height, z, "minecraft:amethyst_cluster");
    if (rng.chance(0.5)) world.set(x + 1, y + 1, z, "minecraft:amethyst_cluster");
    return;
  }
  if (kind === "dead") {
    const height = rng.int(2, 5);
    for (let i = 0; i < height; i++) world.set(x, y + i, z, OAK_LOG);
    world.set(x + 1, y + height - 1, z, OAK_LOG);
    world.set(x - 1, y + height - 2, z, OAK_LOG);
    return;
  }
  if (kind === "palm") {
    const trunk = rng.int(6, 10);
    for (let i = 0; i < trunk; i++) {
      world.set(x + (i > trunk - 3 ? 1 : 0), y + i, z, "minecraft:jungle_log");
    }
    const top = y + trunk;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (dx * dx + dz * dz > 9) continue;
        if (rng.chance(0.18)) continue;
        world.set(x + 1 + dx, top, z + dz, "minecraft:jungle_leaves");
      }
    }
    world.set(x + 1, top - 1, z, "minecraft:jungle_leaves");
    return;
  }
  if (kind === "birch") {
    const trunk = rng.int(5, 7);
    for (let i = 0; i < trunk; i++) world.set(x, y + i, z, "minecraft:birch_log");
    const top = y + trunk;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy === 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
          if (rng.chance(0.18)) continue;
          const lx = x + dx;
          const ly = top + dy;
          const lz = z + dz;
          if (world.get(lx, ly, lz) === AIR) world.set(lx, ly, lz, "minecraft:birch_leaves");
        }
      }
    }
    return;
  }
  if (kind === "jungle") {
    const trunk = rng.int(7, 12);
    for (let i = 0; i < trunk; i++) world.set(x, y + i, z, "minecraft:jungle_log");
    const top = y + trunk;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy === 1 ? 1 : 3;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dz * dz > radius * radius) continue;
          if (rng.chance(0.22)) continue;
          if (world.get(x + dx, top + dy, z + dz) === AIR) {
            world.set(x + dx, top + dy, z + dz, "minecraft:jungle_leaves");
          }
        }
      }
    }
    return;
  }
  const trunk = kind === "spruce" ? rng.int(6, 9) : rng.int(4, 6);
  const log = kind === "spruce" ? SPRUCE_LOG : OAK_LOG;
  const leaves = kind === "spruce" ? SPRUCE_LEAVES : OAK_LEAVES;
  for (let i = 0; i < trunk; i++) world.set(x, y + i, z, log);
  if (kind === "oak") {
    const top = y + trunk;
    for (let dy = -2; dy <= 2; dy++) {
      const radius = dy === 2 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          if (rng.chance(0.22)) continue;
          const lx = x + dx;
          const lz = z + dz;
          if (!world.inBounds(lx, top + dy, lz)) continue;
          if (world.get(lx, top + dy, lz) === AIR) world.set(lx, top + dy, lz, leaves);
        }
      }
    }
    world.set(x, y + trunk + 2, z, leaves);
  } else {
    const top = y + trunk;
    for (let dy = 0; dy < trunk; dy++) {
      const radius = Math.max(0, Math.floor((trunk - dy) / 3));
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius) continue;
          if (dx === 0 && dz === 0) continue;
          const ly = y + dy + 1;
          const lx = x + dx;
          const lz = z + dz;
          if (world.get(lx, ly, lz) === AIR) world.set(lx, ly, lz, leaves);
        }
      }
    }
    world.set(x, top + 1, z, leaves);
    world.set(x, top, z, leaves);
  }
}

function scatterRocksAndBushes(
  world: VoxelWorld,
  layout: SiteLayout,
  heights: Int16Array,
  seed: number,
  complexity: Complexity,
  protection: Protection,
  profile?: SiteTerrainRules,
): void {
  const size = layout.worldSize;
  const rng = createRng(seed ^ 0x51a7);
  const count = complexity === "dense" ? 180 : complexity === "balanced" ? 110 : 60;
  for (let i = 0; i < count; i++) {
    const x = rng.int(4, size - 5);
    const z = rng.int(4, size - 5);
    if (insideRect(x, z, layout.moatRect)) continue;
    if (insideRect(x, z, protection.road)) continue;
    if (protection.fields.some((field) => insideRect(x, z, expand(field, 2)))) continue;
    if (protection.hamlet && insideRect(x, z, expand(protection.hamlet, 2))) continue;
    if (protection.features.some((feature) => insideRect(x, z, expand(feature, 1)))) continue;
    const h = heights[z * size + x];
    if (h < 8) continue;
    const surface = world.get(x, h, z);
    if (profile && surface !== profile.surface && surface !== "minecraft:snow_block") continue;
    if (!profile && surface !== GRASS) continue;
    const stone = profile?.stone === "minecraft:deepslate" ? COBBLE : profile ? COBBLE : COBBLE;
    if (rng.chance(0.5)) {
      const radius = rng.int(1, 2);
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dz * dz > radius * radius) continue;
          world.set(x + dx, h + 1, z + dz, rng.chance(0.5) ? stone : MOSSY);
        }
      }
    } else if (profile?.vegetation === "crystal") {
      world.set(x, h + 1, z, "minecraft:amethyst_cluster");
    } else if (profile?.vegetation === "mushroom") {
      world.set(x, h + 1, z, rng.chance(0.5) ? "minecraft:red_mushroom_block" : "minecraft:brown_mushroom_block");
    } else if (profile?.vegetation !== "none") {
      const leaf =
        profile?.vegetation === "jungle" || profile?.vegetation === "palm"
          ? "minecraft:jungle_leaves"
          : profile?.vegetation === "birch"
            ? "minecraft:birch_leaves"
            : profile?.vegetation === "spruce"
              ? SPRUCE_LEAVES
              : OAK_LEAVES;
      world.set(x, h + 1, z, leaf);
      if (rng.chance(0.5)) world.set(x + 1, h + 1, z, leaf);
    }
  }
}

function decorateRoadside(
  world: VoxelWorld,
  layout: SiteLayout,
  heights: Int16Array,
  seed: number,
): void {
  const size = layout.worldSize;
  const rng = createRng(seed ^ 0xbead);
  const half = Math.floor(layout.bridgeWidth / 2);
  for (let z = layout.moatRect.z2 + 10; z < size - 6; z += 11) {
    if (!rng.chance(0.65)) continue;
    const x = layout.centerX + (rng.chance(0.5) ? -half - 2 : half + 2);
    if (x < 2 || x >= size - 2) continue;
    const h = Math.max(heights[z * size + x], 18);
    world.set(x, h + 1, z, OAK_LOG);
    world.set(x, h + 2, z, IRON);
    world.set(x, h + 3, z, GLOWSTONE);
  }
}

function expand(area: Rect, amount: number): Rect {
  return { x1: area.x1 - amount, z1: area.z1 - amount, x2: area.x2 + amount, z2: area.z2 + amount };
}
