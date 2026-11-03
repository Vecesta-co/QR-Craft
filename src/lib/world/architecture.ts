import {
  accentAt,
  doorAt,
  foundationAt,
  moduleDarkAt,
  roofAt,
  roofCapAt,
  wallAt,
  wallTrimAt,
  windowAt,
  type PaintContext,
} from "@/lib/world/paint";
import { STYLES } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { Complexity } from "@/lib/world/site";
import { insideRect } from "@/lib/world/site";
import type { PlacementRecorder } from "@/lib/world/recorder";
import type { Rng } from "@/lib/world/rng";
import type { BlockRect, DoorSide } from "@/lib/world/buildings";
import {
  doorStates,
  fenceFor,
  fenceState,
  ironBarsState,
  lanternState,
  slabFor,
  slabState,
  stairFor,
  stairState,
  trapdoorFor,
  trapdoorState,
  wallFor,
  wallState,
} from "@/lib/world/semantic";

export interface StructureContext extends PaintContext {
  rec: PlacementRecorder;
  baseY: number;
  quality: QualityLevel;
  detailing: number;
  complexity: Complexity;
  rng: Rng;
}

export interface RoofResult {
  /** Lowest roof layer, directly above the wall top. */
  baseY: number;
  /** Highest block placed by the roof pass. */
  topY: number;
  type: string;
}

const HORIZONTAL_FACING: Record<DoorSide, "north" | "south" | "east" | "west"> = {
  north: "north",
  south: "south",
  east: "east",
  west: "west",
};

function qualityRank(quality: QualityLevel): number {
  return quality === "standard" ? 0 : quality === "detailed" ? 1 : 2;
}

function place(
  ctx: StructureContext,
  x: number,
  y: number,
  z: number,
  block: string,
  phase: "walls" | "roofs" | "details",
  group: string,
): void {
  ctx.rec.place(x, y, z, block, phase, group);
}

function fillLayer(
  ctx: StructureContext,
  rect: BlockRect,
  y: number,
  layer: number,
  group: string,
): void {
  for (let z = rect.z1; z <= rect.z2; z++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      place(ctx, x, y, z, roofAt(ctx, x, z, layer), "roofs", group);
    }
  }
}

function perimeterOf(rect: BlockRect): Array<{ x: number; z: number; side: DoorSide }> {
  const out: Array<{ x: number; z: number; side: DoorSide }> = [];
  for (let x = rect.x1; x <= rect.x2; x++) {
    out.push({ x, z: rect.z1, side: "north" });
    if (rect.z2 !== rect.z1) out.push({ x, z: rect.z2, side: "south" });
  }
  for (let z = rect.z1 + 1; z < rect.z2; z++) {
    out.push({ x: rect.x1, z, side: "west" });
    if (rect.x2 !== rect.x1) out.push({ x: rect.x2, z, side: "east" });
  }
  return out;
}

function applyRoofStairs(
  ctx: StructureContext,
  rect: BlockRect,
  y: number,
  group: string,
): void {
  for (const point of perimeterOf(rect)) {
    const base = roofAt(ctx, point.x, point.z, 1);
    const stair = stairFor(base);
    if (!stair) continue;
    place(
      ctx,
      point.x,
      y,
      point.z,
      stairState(stair, HORIZONTAL_FACING[point.side]),
      "roofs",
      group,
    );
  }
}

/**
 * Style-driven roof geometry. Layer zero always covers the complete footprint
 * so every city column retains a class-correct top surface; all later layers
 * only add class-correct roof material above it.
 */
export function raiseRoof(
  ctx: StructureContext,
  rect: BlockRect,
  wallTop: number,
  group: string,
): RoofResult {
  const roof = STYLES[ctx.style].roof;
  const baseY = wallTop + 1;
  let topY = baseY;

  if (roof.type === "flat") {
    fillLayer(ctx, rect, baseY, 0, group);
    topY = baseY;
    if (qualityRank(ctx.quality) >= 1) {
      for (const point of perimeterOf(rect)) {
        place(ctx, point.x, baseY + 1, point.z, wallTrimAt(ctx, point.x, point.z), "details", group);
      }
      topY = baseY + 1;
    }
    return { baseY, topY, type: roof.type };
  }

  // Every non-flat roof starts with a full, class-correct footprint layer.
  fillLayer(ctx, rect, baseY, 0, group);

  if (roof.type === "gable" || roof.type === "stepped") {
    const ridgeAlongX = rect.x2 - rect.x1 >= rect.z2 - rect.z1;
    let x1 = rect.x1;
    let x2 = rect.x2;
    let z1 = rect.z1;
    let z2 = rect.z2;
    let y = baseY;
    let layer = 0;
    while (x1 <= x2 && z1 <= z2 && layer < 18) {
      if (roof.type === "gable" && layer > 0) applyRoofStairs(ctx, { x1, z1, x2, z2 }, y, group);
      topY = Math.max(topY, y);
      const canShrink = ridgeAlongX ? z2 - z1 >= 2 : x2 - x1 >= 2;
      if (!canShrink) break;
      if (ridgeAlongX) {
        z1++;
        z2--;
      } else {
        x1++;
        x2--;
      }
      y += roof.pitch >= 0.85 ? 2 : 1;
      layer++;
      fillLayer(ctx, { x1, z1, x2, z2 }, y, layer, group);
    }
    return { baseY, topY, type: roof.type };
  }

  if (roof.type === "hip" || roof.type === "spire") {
    let x1 = rect.x1;
    let x2 = rect.x2;
    let z1 = rect.z1;
    let z2 = rect.z2;
    let y = baseY;
    let layer = 0;
    while (x1 <= x2 && z1 <= z2 && layer < 18) {
      topY = Math.max(topY, y);
      x1++;
      x2--;
      z1++;
      z2--;
      y++;
      layer++;
      if (x1 > x2 || z1 > z2) break;
      fillLayer(ctx, { x1, z1, x2, z2 }, y, layer, group);
    }
    if (roof.type === "spire") {
      const cx = Math.floor((rect.x1 + rect.x2) / 2);
      const cz = Math.floor((rect.z1 + rect.z2) / 2);
      const needle = Math.max(2, Math.round(3 + roof.pitch * 4));
      for (let i = 1; i <= needle; i++) {
        place(ctx, cx, topY + i, cz, roofAt(ctx, cx, cz, 2 + i), "roofs", group);
      }
      topY += needle;
    }
    return { baseY, topY, type: roof.type };
  }

  if (roof.type === "dome") {
    const cx = (rect.x1 + rect.x2) / 2;
    const cz = (rect.z1 + rect.z2) / 2;
    const halfX = (rect.x2 - rect.x1) / 2;
    const halfZ = (rect.z2 - rect.z1) / 2;
    const layers = Math.max(2, Math.min(12, Math.ceil(Math.min(halfX, halfZ))));
    for (let layer = 1; layer <= layers; layer++) {
      const rx = Math.max(1, halfX * (1 - layer / (layers + 0.6)));
      const rz = Math.max(1, halfZ * (1 - layer / (layers + 0.6)));
      const y = baseY + layer;
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x - cx) / Math.max(0.5, rx);
          const nz = (z - cz) / Math.max(0.5, rz);
          if (nx * nx + nz * nz > 1.05) continue;
          place(ctx, x, y, z, roofAt(ctx, x, z, layer), "roofs", group);
        }
      }
      topY = Math.max(topY, y);
    }
    const cxI = Math.round(cx);
    const czI = Math.round(cz);
    place(ctx, cxI, topY + 1, czI, roofCapAt(ctx, cxI, czI), "roofs", group);
    topY += 1;
    return { baseY, topY, type: roof.type };
  }

  if (roof.type === "pagoda") {
    let inset = 0;
    let tier = 0;
    while (inset * 2 < rect.x2 - rect.x1 && inset * 2 < rect.z2 - rect.z1 && tier < 3) {
      const r: BlockRect = {
        x1: rect.x1 + inset,
        z1: rect.z1 + inset,
        x2: rect.x2 - inset,
        z2: rect.z2 - inset,
      };
      const y = baseY + tier * 3;
      fillLayer(ctx, r, y, tier + 1, group);
      topY = Math.max(topY, y);
      // Deep eaves read as separate roofs from above.
      if (tier > 0) {
        for (const point of perimeterOf(r)) {
          place(ctx, point.x, y + 1, point.z, roofAt(ctx, point.x, point.z, 0), "roofs", group);
        }
        topY = Math.max(topY, y + 1);
      }
      inset += 2;
      tier++;
    }
    const cx = Math.floor((rect.x1 + rect.x2) / 2);
    const cz = Math.floor((rect.z1 + rect.z2) / 2);
    for (let i = 1; i <= 4; i++) {
      place(ctx, cx, topY + i, cz, roofAt(ctx, cx, cz, 2 + i), "roofs", group);
    }
    topY += 4;
    return { baseY, topY, type: roof.type };
  }

  if (roof.type === "sawtooth") {
    for (let x = rect.x1; x <= rect.x2; x++) {
      const phase = Math.abs(((x - rect.x1) % 6) - 3);
      const y = baseY + (phase < 2 ? 2 : 1);
      for (let z = rect.z1; z <= rect.z2; z++) {
        place(ctx, x, y, z, roofAt(ctx, x, z, 1 + (y - baseY)), "roofs", group);
      }
      topY = Math.max(topY, y);
    }
    return { baseY, topY, type: roof.type };
  }

  if (roof.type === "clerestory") {
    const inset = Math.max(1, Math.floor((rect.x2 - rect.x1) / 4));
    const inner: BlockRect = {
      x1: rect.x1 + inset,
      x2: rect.x2 - inset,
      z1: rect.z1 + inset,
      z2: rect.z2 - inset,
    };
    if (inner.x1 <= inner.x2 && inner.z1 <= inner.z2) {
      for (let z = inner.z1; z <= inner.z2; z++) {
        for (let x = inner.x1; x <= inner.x2; x++) {
          place(ctx, x, baseY + 1, z, wallAt(ctx, x, baseY + 1, z), "walls", group);
          place(ctx, x, baseY + 2, z, roofAt(ctx, x, z, 2), "roofs", group);
        }
      }
      for (const point of perimeterOf(inner)) {
        place(ctx, point.x, baseY + 1, point.z, windowAt(ctx, point.x, point.z), "details", group);
      }
      topY = baseY + 2;
    } else {
      place(ctx, Math.floor((rect.x1 + rect.x2) / 2), baseY + 1, Math.floor((rect.z1 + rect.z2) / 2), roofAt(ctx, rect.x1, rect.z1, 1), "roofs", group);
      topY = baseY + 1;
    }
    return { baseY, topY, type: roof.type };
  }

  // Ruined roofs keep the full class-correct base and only add uneven upper
  // patches, never holes that would expose differently-classed wall tops.
  const spanX = rect.x2 - rect.x1 + 1;
  const spanZ = rect.z2 - rect.z1 + 1;
  for (let z = rect.z1; z <= rect.z2; z++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      const hash = (Math.imul(x + 17, 73856093) ^ Math.imul(z + 31, 19349663)) >>> 0;
      const lift = hash % 5 === 0 ? 2 : hash % 3 === 0 ? 1 : 0;
      for (let i = 1; i <= lift; i++) {
        place(ctx, x, baseY + i, z, roofAt(ctx, x, z, i + 1), "roofs", group);
      }
      topY = Math.max(topY, baseY + lift);
    }
  }
  if (spanX > 2 && spanZ > 2) {
    const cx = Math.floor((rect.x1 + rect.x2) / 2);
    const cz = Math.floor((rect.z1 + rect.z2) / 2);
    place(ctx, cx, topY + 1, cz, roofCapAt(ctx, cx, cz), "roofs", group);
    topY += 1;
  }
  return { baseY, topY, type: roof.type };
}

/** Wall grammar: banding, buttresses, timber framing, arcades and weathering. */
export function applyWallGrammar(
  ctx: StructureContext,
  rect: BlockRect,
  firstWall: number,
  wallTop: number,
  door: { x: number; z: number },
  group: string,
): void {
  const style = STYLES[ctx.style];
  const wall = style.wall;
  const quality = qualityRank(ctx.quality);
  const perimeter = perimeterOf(rect);

  for (const point of perimeter) {
    if (point.x === door.x && point.z === door.z) continue;
    if (wall.banding !== "none" && wallTop - firstWall >= 3) {
      const bandY = firstWall + 1;
      if (ballingUsesTrim(wall.banding)) {
        place(ctx, point.x, bandY, point.z, wallTrimAt(ctx, point.x, point.z), "details", group);
      } else if (wall.banding === "timber") {
        place(ctx, point.x, bandY, point.z, accentAt(ctx, point.x, point.z), "details", group);
      } else if (wall.banding === "crystal") {
        place(ctx, point.x, bandY, point.z, windowAt(ctx, point.x, point.z), "details", group);
      }
    }
  }

  if (wall.buttresses > 0 || wall.pilasters) {
    const spacing = wall.buttresses > 0 ? Math.max(2, wall.buttresses) : 4;
    for (const point of perimeter) {
      const along = point.side === "north" || point.side === "south" ? point.x - rect.x1 : point.z - rect.z1;
      if (along % spacing !== 0) continue;
      for (let y = firstWall; y < wallTop; y++) {
        place(ctx, point.x, y, point.z, wallTrimAt(ctx, point.x, point.z), "walls", group);
      }
    }
  }

  if (wall.type === "timber") {
    for (const point of perimeter) {
      const corner = point.x === rect.x1 || point.x === rect.x2;
      const zCorner = point.z === rect.z1 || point.z === rect.z2;
      if (corner && zCorner) {
        for (let y = firstWall; y < wallTop; y++) {
          place(ctx, point.x, y, point.z, accentAt(ctx, point.x, point.z), "walls", group);
        }
      }
    }
  }

  if (wall.type === "arcade" && quality >= 1) {
    for (const point of perimeter) {
      if (point.side !== "south" && point.side !== "west") continue;
      if (point.x === door.x && point.z === door.z) continue;
      const along = point.side === "south" ? point.x - rect.x1 : point.z - rect.z1;
      if (along % 3 === 0) continue;
      place(ctx, point.x, firstWall + 1, point.z, "minecraft:air", "details", group);
      if (wallTop - firstWall >= 4) place(ctx, point.x, firstWall + 2, point.z, "minecraft:air", "details", group);
    }
  }

  if (wall.type === "rusticated") {
    for (const point of perimeter) {
      place(ctx, point.x, firstWall, point.z, foundationAt(ctx, point.x, point.z), "walls", group);
    }
  }

  if (wall.type === "panelled" && quality >= 1) {
    for (const point of perimeter) {
      const along = point.side === "north" || point.side === "south" ? point.x - rect.x1 : point.z - rect.z1;
      if (along % 2 !== 0) continue;
      place(ctx, point.x, firstWall + 1, point.z, accentAt(ctx, point.x, point.z), "details", group);
    }
  }

  if (wall.type === "overgrown" || style.detail.weathering > 0.35) {
    for (const point of perimeter) {
      if (!ctx.rng.chance(0.16 + style.detail.weathering * 0.25)) continue;
      if (point.x === door.x && point.z === door.z) continue;
      place(ctx, point.x, firstWall, point.z, "minecraft:oak_leaves", "details", group);
    }
  }
}

function ballingUsesTrim(banding: string): boolean {
  return banding === "stone" || banding === "brick" || banding === "plaster";
}

function windowShape(
  ctx: StructureContext,
  x: number,
  z: number,
  y: number,
  wallTop: number,
  side: DoorSide,
  group: string,
): void {
  const style = STYLES[ctx.style];
  const grammar = style.window;
  const facing = HORIZONTAL_FACING[side];
  const width = grammar.width;
  const tall =
    grammar.type === "lancet" ||
    grammar.type === "arched" ||
    grammar.type === "round" ||
    grammar.type === "rose";
  const glass = grammar.bars ? ironBarsState() : windowAt(ctx, x, z);
  const put = (wx: number, wy: number, wz: number, block: string) =>
    place(ctx, wx, wy, wz, block, "details", group);
  const alongX = side === "north" || side === "south";

  if (grammar.type === "ruined" && ctx.rng.chance(0.35)) {
    put(x, y, z, "minecraft:air");
    return;
  }

  for (let w = 0; w < width; w++) {
    const wx = alongX ? x + w : x;
    const wz = alongX ? z : z + w;
    put(wx, y, wz, glass);
    if (tall && y + 1 <= wallTop) put(wx, y + 1, wz, glass);
    if ((grammar.type === "lancet" || grammar.type === "arched") && y + 2 <= wallTop) {
      put(wx, y + 2, wz, wallTrimAt(ctx, wx, wz));
    }
    if (grammar.type === "slit" && y + 1 <= wallTop) {
      put(wx, y + 1, wz, glass);
      if (y + 2 <= wallTop) put(wx, y + 2, wz, wallTrimAt(ctx, wx, wz));
    }
    if ((grammar.type === "round" || grammar.type === "rose") && y - 1 > ctx.baseY + 1) {
      put(wx, y - 1, wz, wallTrimAt(ctx, wx, wz));
    }
    if (grammar.type === "grid" && width > 1 && y + 1 <= wallTop) {
      const mx = alongX ? x + 1 : x;
      const mz = alongX ? z : z + 1;
      put(mx, y + 1, mz, wallTrimAt(ctx, mx, mz));
    }
  }
  if (grammar.shutters && qualityRank(ctx.quality) >= 1) {
    const trapdoor = trapdoorFor(accentAt(ctx, x, z));
    if (trapdoor) {
      const state = trapdoorState(trapdoor, facing, true);
      if (alongX) {
        put(x, y, z + (side === "north" ? 1 : -1), state);
      } else {
        put(x + (side === "west" ? 1 : -1), y, z, state);
      }
    }
  }
}

export function placeWindows(
  ctx: StructureContext,
  rect: BlockRect,
  firstWall: number,
  wallTop: number,
  doorSide: DoorSide,
  door: { x: number; z: number },
  group: string,
): void {
  const style = STYLES[ctx.style];
  const spacing = Math.max(1, style.window.spacing);
  const y = firstWall + Math.max(1, Math.floor((wallTop - firstWall) / 2));
  for (let x = rect.x1 + 1; x <= rect.x2 - 1; x += spacing) {
    if (doorSide === "north" && x === door.x) continue;
    if (doorSide === "south" && x === door.x) continue;
    windowShape(ctx, x, rect.z1, y, wallTop, "north", group);
    if (rect.z2 !== rect.z1) windowShape(ctx, x, rect.z2, y, wallTop, "south", group);
  }
  for (let z = rect.z1 + 1; z <= rect.z2 - 1; z += spacing) {
    if (doorSide === "west" && z === door.z) continue;
    if (doorSide === "east" && z === door.z) continue;
    windowShape(ctx, rect.x1, z, y, wallTop, "west", group);
    if (rect.x2 !== rect.x1) windowShape(ctx, rect.x2, z, y, wallTop, "east", group);
  }
}

export function placeDoor(
  ctx: StructureContext,
  rect: BlockRect,
  firstWall: number,
  side: DoorSide,
  group: string,
): { x: number; z: number } {
  const style = STYLES[ctx.style];
  const grammar = style.door;
  const cx = Math.floor((rect.x1 + rect.x2) / 2);
  const cz = Math.floor((rect.z1 + rect.z2) / 2);
  const x = side === "north" || side === "south" ? cx : side === "west" ? rect.x1 : rect.x2;
  const z = side === "east" || side === "west" ? cz : side === "north" ? rect.z1 : rect.z2;
  const door = doorAt(ctx, x, z);
  const double = grammar.type === "double" || grammar.type === "gate";
  const positions: Array<{ x: number; z: number }> = [{ x, z }];
  if (double) {
    if (side === "north" || side === "south") positions.push({ x: x + 1, z });
    else positions.push({ x, z: z + 1 });
  }
  for (const position of positions) {
    const [lower, upper] = doorStates(door, HORIZONTAL_FACING[side]);
    place(ctx, position.x, firstWall, position.z, lower, "details", group);
    place(ctx, position.x, firstWall + 1, position.z, upper, "details", group);
    if (grammar.type === "portcullis" || grammar.type === "gate") {
      place(ctx, position.x, firstWall + 1, position.z, ironBarsState(), "details", group);
    }
    if (grammar.type === "arched" || grammar.type === "round") {
      place(ctx, position.x, firstWall + 2, position.z, wallTrimAt(ctx, position.x, position.z), "details", group);
    }
    if (grammar.frame) {
      place(ctx, position.x, firstWall + 2, position.z, accentAt(ctx, position.x, position.z), "details", group);
      if (side === "north" || side === "south") {
        place(ctx, position.x - 1, firstWall, position.z, accentAt(ctx, position.x - 1, position.z), "details", group);
        place(ctx, position.x + 1, firstWall, position.z, accentAt(ctx, position.x + 1, position.z), "details", group);
      } else {
        place(ctx, position.x, firstWall, position.z - 1, accentAt(ctx, position.x, position.z - 1), "details", group);
        place(ctx, position.x, firstWall, position.z + 1, accentAt(ctx, position.x, position.z + 1), "details", group);
      }
    }
    if (grammar.type === "timber") {
      place(ctx, position.x, firstWall + 2, position.z, accentAt(ctx, position.x, position.z), "details", group);
    }
  }
  return { x, z };
}

/** Quality-gated detailing: paths, balconies, planters, chimneys and finials. */
export function applyQualityDetails(
  ctx: StructureContext,
  rect: BlockRect,
  firstWall: number,
  wallTop: number,
  roof: RoofResult,
  doorSide: DoorSide,
  door: { x: number; z: number },
  group: string,
): void {
  const rank = qualityRank(ctx.quality);
  if (rank === 0) return;
  const style = STYLES[ctx.style];
  const detail = style.detail;

  // Entrance path outside the footprint, kept within the city so the slabs
  // receive the correct QR class from the ground helper.
  const pathLength = rank === 2 ? 3 : 2;
  for (let step = 1; step <= pathLength; step++) {
    const x = doorSide === "west" ? door.x - step : doorSide === "east" ? door.x + step : door.x;
    const z = doorSide === "north" ? door.z - step : doorSide === "south" ? door.z + step : door.z;
    if (!insideRect(x, z, ctx.layout.cityRect)) continue;
    const base = roofAt(ctx, x, z, 0);
    const slab = slabFor(base) ?? slabFor(accentAt(ctx, x, z));
    if (slab) {
      place(ctx, x, ctx.baseY, z, slabState(slab), "details", group);
    }
  }

  if (detail.planters) {
    const px = doorSide === "west" ? door.x + 1 : doorSide === "east" ? door.x - 1 : door.x + 1;
    const pz = doorSide === "north" ? door.z + 1 : doorSide === "south" ? door.z - 1 : door.z;
    if (px >= rect.x1 && px <= rect.x2 && pz >= rect.z1 && pz <= rect.z2) {
      place(ctx, px, firstWall, pz, "minecraft:flower_pot", "details", group);
    }
  }

  if (detail.balconies) {
    const accent = accentAt(ctx, rect.x1, rect.z1);
    const fence = fenceFor(accent) ?? fenceFor(wallTrimAt(ctx, rect.x1, rect.z1));
    const slab = slabFor(wallTrimAt(ctx, rect.x1, rect.z1));
    const y = firstWall + Math.max(1, Math.floor((wallTop - firstWall) / 2)) - 1;
    if (fence && slab) {
      for (let x = rect.x1 + 1; x <= rect.x2 - 1; x += 3) {
        place(ctx, x, y, rect.z2, slabState(slab), "details", group);
        place(ctx, x, y + 1, rect.z2, fenceState(fence, false), "details", group);
      }
    }
  }

  if (detail.banners) {
    for (const point of perimeterOf(rect)) {
      if ((point.x + point.z) % 5 !== 0) continue;
      place(ctx, point.x, firstWall + 1, point.z, accentAt(ctx, point.x, point.z), "details", group);
    }
  }

  if (detail.chimneys) {
    const chimneyX = ctx.rng.chance(0.5) ? rect.x1 : rect.x2;
    const chimneyZ = ctx.rng.chance(0.5) ? rect.z1 : rect.z2;
    for (let y = wallTop + 1; y <= roof.topY + 1; y++) {
      place(ctx, chimneyX, y, chimneyZ, wallTrimAt(ctx, chimneyX, chimneyZ), "details", group);
    }
    place(ctx, chimneyX, roof.topY + 2, chimneyZ, roofCapAt(ctx, chimneyX, chimneyZ), "details", group);
  }

  if (detail.dormers && roof.topY > roof.baseY + 1) {
    const midX = Math.floor((rect.x1 + rect.x2) / 2);
    const z = rect.z1;
    place(ctx, midX, roof.baseY + 1, z, windowAt(ctx, midX, z), "details", group);
    place(ctx, midX, roof.baseY + 2, z, roofAt(ctx, midX, z, 1), "details", group);
  }

  // Hanging lanterns under the roof edge are below the top projection.
  const lanternCount = rank === 2 ? 4 : 2;
  for (let i = 0; i < lanternCount; i++) {
    const side = i % 2 === 0 ? "south" : "north";
    const x = rect.x1 + 1 + ((i * 2) % Math.max(1, rect.x2 - rect.x1 - 1));
    const z = side === "south" ? rect.z2 : rect.z1;
    if (x < rect.x1 || x > rect.x2) continue;
    place(ctx, x, wallTop, z, lanternState(true), "details", group);
  }

  if (rank >= 2) {
    // Corner finials only use roof material, so every top column remains
    // class-correct for the QR projection.
    for (const [x, z] of [
      [rect.x1, rect.z1],
      [rect.x2, rect.z1],
      [rect.x1, rect.z2],
      [rect.x2, rect.z2],
    ]) {
      place(ctx, x, roof.topY + 1, z, roofAt(ctx, x, z, 2), "details", group);
      place(ctx, x, roof.topY + 2, z, roofCapAt(ctx, x, z), "details", group);
    }
    if (style.roof.type === "flat") {
      for (const point of perimeterOf(rect)) {
        const wall = wallFor(wallTrimAt(ctx, point.x, point.z));
        if (wall) place(ctx, point.x, roof.topY + 1, point.z, wallState(wall), "details", group);
      }
    }
    // A finer eave rail on showcase houses. Each post is selected from that
    // column's own accent so the rail's projection class matches every module.
    if (qualityRank(ctx.quality) >= 2) {
      for (let x = rect.x1 + 1; x <= rect.x2 - 1; x += 2) {
        const fence = fenceFor(accentAt(ctx, x, rect.z1));
        if (fence) {
          place(ctx, x, roof.baseY, rect.z1, fenceState(fence, false), "details", group);
        }
      }
    }
  }
}

void moduleDarkAt;
