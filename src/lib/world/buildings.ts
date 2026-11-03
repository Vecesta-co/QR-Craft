import {
  accentAt,
  foundationAt,
  roofAt,
  wallAt,
  wallTrimAt,
  windowAt,
  type PaintContext,
} from "@/lib/world/paint";
import { STYLES } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";
import type { Complexity } from "@/lib/world/site";
import type { PlacementRecorder } from "@/lib/world/recorder";
import type { Rng } from "@/lib/world/rng";
import {
  applyQualityDetails,
  applyWallGrammar,
  placeDoor,
  placeWindows,
  raiseRoof,
} from "@/lib/world/architecture";
import { ironBarsState } from "@/lib/world/semantic";

export type DoorSide = "north" | "south" | "east" | "west";

export interface BlockRect {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface BuildingContext extends PaintContext {
  rec: PlacementRecorder;
  baseY: number;
  site: SiteId;
  quality: QualityLevel;
  detailing: number;
  complexity: Complexity;
  rng: Rng;
}

export interface BuildingResult {
  topY: number;
  towers: number;
  type: "house" | "tower" | "manor" | "stall";
}

interface HouseOptions {
  group: string;
  doorSide?: DoorSide;
  wallHeight?: number;
  variant?: number;
}

type Side = DoorSide;

const forPerimeter = (rect: BlockRect, visit: (x: number, z: number) => void): void => {
  for (let x = rect.x1; x <= rect.x2; x++) {
    visit(x, rect.z1);
    if (rect.z2 !== rect.z1) visit(x, rect.z2);
  }
  for (let z = rect.z1 + 1; z < rect.z2; z++) {
    visit(rect.x1, z);
    if (rect.x2 !== rect.x1) visit(rect.x2, z);
  }
};

const forFootprint = (rect: BlockRect, visit: (x: number, z: number) => void): void => {
  for (let z = rect.z1; z <= rect.z2; z++) {
    for (let x = rect.x1; x <= rect.x2; x++) visit(x, z);
  }
};

function doorPosition(rect: BlockRect, side: Side): { x: number; z: number; axis: "x" | "z" } {
  const cx = Math.floor((rect.x1 + rect.x2) / 2);
  const cz = Math.floor((rect.z1 + rect.z2) / 2);
  if (side === "north") return { x: cx, z: rect.z1, axis: "x" };
  if (side === "south") return { x: cx, z: rect.z2, axis: "x" };
  if (side === "west") return { x: rect.x1, z: cz, axis: "z" };
  return { x: rect.x2, z: cz, axis: "z" };
}

/** House whose roof, walls, windows, door and details follow its style grammar. */
export function buildHouse(
  ctx: BuildingContext,
  rect: BlockRect,
  options: HouseOptions,
): BuildingResult {
  const { rec } = ctx;
  const group = options.group;
  const style = STYLES[ctx.style];
  const qualityHeight = ctx.quality === "showcase" ? 1.08 : ctx.quality === "standard" ? 0.94 : 1;
  const wallHeight =
    options.wallHeight ??
    Math.max(3, Math.round(style.proportions.wallHeight * qualityHeight));
  const firstWall = ctx.baseY + 2;
  const wallTop = firstWall + wallHeight - 1;
  const doorSide = options.doorSide ?? "south";

  forFootprint(rect, (x, z) => {
    rec.place(x, ctx.baseY + 1, z, foundationAt(ctx, x, z), "foundation", group);
  });
  for (let y = firstWall; y <= wallTop; y++) {
    const trim = y === wallTop;
    forPerimeter(rect, (x, z) => {
      rec.place(
        x,
        y,
        z,
        trim ? wallTrimAt(ctx, x, z) : wallAt(ctx, x, y, z),
        trim ? "details" : "walls",
        group,
      );
    });
  }

  const door = doorPosition(rect, doorSide);
  applyWallGrammar(ctx, rect, firstWall, wallTop, door, group);
  placeDoor(ctx, rect, firstWall, doorSide, group);
  placeWindows(ctx, rect, firstWall, wallTop, doorSide, door, group);

  const roof = raiseRoof(ctx, rect, wallTop, group);
  applyQualityDetails(ctx, rect, firstWall, wallTop, roof, doorSide, door, group);

  return { topY: roof.topY, towers: 0, type: "house" };
}

/** Crenellated tower with an inset stepped spire. */
export function buildTower(
  ctx: BuildingContext,
  rect: BlockRect,
  options: { group: string; height?: number },
): BuildingResult {
  const { rec } = ctx;
  const group = options.group;
  const height = options.height ?? ctx.rng.int(10, 16);
  const firstWall = ctx.baseY + 2;
  const wallTop = firstWall + height - 1;

  forFootprint(rect, (x, z) => {
    rec.place(x, ctx.baseY + 1, z, foundationAt(ctx, x, z), "foundation", group);
    for (let y = firstWall; y <= wallTop; y++) {
      rec.place(
        x,
        y,
        z,
        y === wallTop ? wallTrimAt(ctx, x, z) : wallAt(ctx, x, y, z),
        y === wallTop ? "details" : "walls",
        group,
      );
    }
  });

  const style = STYLES[ctx.style];
  if (style.roof.ornament === "battlements" || ctx.quality === "showcase") {
    forPerimeter(rect, (x, z) => {
      if ((x + z) % 2 === 0) {
        rec.place(x, wallTop + 1, z, wallTrimAt(ctx, x, z), "details", group);
      }
    });
  }

  const midX = Math.floor((rect.x1 + rect.x2) / 2);
  const midZ = Math.floor((rect.z1 + rect.z2) / 2);
  const windowY = firstWall + Math.min(3, Math.max(1, height - 3));
  const glass = style.window.bars ? ironBarsState() : windowAt(ctx, midX, rect.z1);
  rec.place(midX, windowY, rect.z1, glass, "details", group);
  rec.place(rect.x1, windowY, midZ, windowAt(ctx, rect.x1, midZ), "details", group);
  rec.place(rect.x2, windowY, midZ, windowAt(ctx, rect.x2, midZ), "details", group);

  const inner: BlockRect = {
    x1: rect.x1 + 1,
    x2: rect.x2 - 1,
    z1: rect.z1 + 1,
    z2: rect.z2 - 1,
  };
  const roofRect =
    inner.x1 <= inner.x2 && inner.z1 <= inner.z2 ? inner : rect;
  const roof = raiseRoof(ctx, roofRect, wallTop, group);

  return { topY: roof.topY, towers: 1, type: "tower" };
}

/** A broad manor with two raised corner turrets. */
export function buildManor(
  ctx: BuildingContext,
  rect: BlockRect,
  options: { group: string; doorSide?: DoorSide },
): BuildingResult {
  const result = buildHouse(ctx, rect, {
    group: options.group,
    doorSide: options.doorSide,
    wallHeight: 6,
    variant: 1,
  });
  const turret = 2;
  let top = result.topY;
  for (const [x, z] of [
    [rect.x1, rect.z1],
    [rect.x2 - turret + 1, rect.z1],
  ]) {
    const turretRect: BlockRect = { x1: x, z1: z, x2: x + turret - 1, z2: z + turret - 1 };
    const base = ctx.baseY + 3;
    const height = 11 + ctx.rng.int(0, 2);
    forFootprint(turretRect, (tx, tz) => {
      for (let y = base; y <= base + height; y++) {
        ctx.rec.place(
          tx,
          y,
          tz,
          y === base + height ? wallTrimAt(ctx, tx, tz) : wallAt(ctx, tx, y, tz),
          y === base + height ? "details" : "walls",
          options.group,
        );
      }
    });
    const turretRoof = raiseRoof(ctx, turretRect, base + height, options.group);
    top = Math.max(top, turretRoof.topY);
  }
  return { topY: top, towers: 2, type: "manor" };
}

/** Market stall with a class-correct canopy and visible merchandise. */
export function buildMarketStall(
  ctx: BuildingContext,
  rect: BlockRect,
  options: { group: string },
): BuildingResult {
  const { rec } = ctx;
  const group = options.group;
  const y0 = ctx.baseY + 1;
  for (const [x, z] of [
    [rect.x1, rect.z1],
    [rect.x1, rect.z2],
    [rect.x2, rect.z1],
    [rect.x2, rect.z2],
  ]) {
    for (let y = y0; y <= y0 + 2; y++) {
      rec.place(x, y, z, accentAt(ctx, x, z), "walls", group);
    }
  }
  forFootprint(rect, (x, z) => {
    rec.place(x, y0 + 3, z, roofAt(ctx, x, z, 1), "roofs", group);
  });
  for (let x = rect.x1 + 1; x < rect.x2; x++) {
    rec.place(x, y0 + 1, Math.floor((rect.z1 + rect.z2) / 2), accentAt(ctx, x, rect.z1), "details", group);
  }
  if (rect.x2 - rect.x1 >= 2) {
    rec.place(rect.x1 + 1, y0 + 1, rect.z1 + 1, foundationAt(ctx, rect.x1 + 1, rect.z1 + 1), "details", group);
  }
  return { topY: y0 + 3, towers: 0, type: "stall" };
}
