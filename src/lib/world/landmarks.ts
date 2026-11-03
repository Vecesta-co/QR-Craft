import { finderOrigins, type QRMatrix } from "@/lib/qr/matrix";
import type { PlacementRecorder } from "@/lib/world/recorder";
import type { Rng } from "@/lib/world/rng";
import { moduleWorldRect, type SiteLayout } from "@/lib/world/site";
import type { Complexity } from "@/lib/world/site";
import { buildHouse, buildTower, type BlockRect, type BuildingContext } from "@/lib/world/buildings";
import {
  accentAt,
  foundationAt,
  groundAt,
  roofAt,
  roofCapAt,
  wallAt,
  wallTrimAt,
  windowAt,
} from "@/lib/world/paint";
import { STYLES, type StyleId } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";
import { siteFor } from "@/lib/sites/registry";
import { lanternState } from "@/lib/world/semantic";
import { raiseRoof } from "@/lib/world/architecture";

export interface LandmarkContext {
  rec: PlacementRecorder;
  layout: SiteLayout;
  style: StyleId;
  site: SiteId;
  quality: QualityLevel;
  detailing: number;
  landmarkScale: number;
  complexity: Complexity;
  rng: Rng;
  baseY: number;
}

function siteOf(ctx: LandmarkContext) {
  return siteFor(ctx.site);
}

function focusScale(ctx: LandmarkContext, kind: "keep" | "cathedral" | "bastion"): number {
  const focus = siteOf(ctx).landmarks.cityFocus;
  if (focus === "balanced") return 1;
  if (
    (focus === "castle" && kind === "keep") ||
    (focus === "cathedral" && kind === "cathedral") ||
    (focus === "bastion" && kind === "bastion")
  ) {
    return 1.22;
  }
  return 0.9;
}

function landmarkDetail(
  ctx: LandmarkContext,
  rect: BlockRect,
  battlementsY: number,
  group: string,
): void {
  if (ctx.quality === "standard") return;
  const style = STYLES[ctx.style];
  const lanternY = battlementsY - 1;
  // Lanterns hang below the merlons. The battlement above them is class-correct
  // trim, so no neutral lantern ever becomes a QR top surface.
  for (let x = rect.x1; x <= rect.x2; x++) {
    for (const z of [rect.z1, rect.z2]) {
      if ((x + z) % 2 !== 0) continue;
      ctx.rec.place(x, lanternY, z, lanternState(true), "details", group);
    }
  }
  for (let z = rect.z1 + 1; z < rect.z2; z++) {
    for (const x of [rect.x1, rect.x2]) {
      if ((x + z) % 2 !== 0) continue;
      ctx.rec.place(x, lanternY, z, lanternState(true), "details", group);
    }
  }
  if (ctx.quality === "showcase" && style.roof.ornament === "banners") {
    for (let x = rect.x1 + 2; x <= rect.x2 - 2; x += 4) {
      ctx.rec.place(x, ctx.layout.cityGroundY + 7, rect.z2, accentAt(ctx, x, rect.z2), "details", group);
    }
  }
}

export interface LandmarkResult {
  id: string;
  label: string;
  topY: number;
}

const originFor = (qr: QRMatrix, index: number) => finderOrigins(qr)[index];

function modules(
  layout: SiteLayout,
  origin: { row: number; col: number },
  row1: number,
  col1: number,
  row2: number,
  col2: number,
): BlockRect {
  const topLeft = moduleWorldRect(layout, origin.row + row1, origin.col + col1);
  const bottomRight = moduleWorldRect(layout, origin.row + row2, origin.col + col2);
  return { x1: topLeft.x1, z1: topLeft.z1, x2: bottomRight.x2, z2: bottomRight.z2 };
}

function shade(
  ctx: LandmarkContext,
  rect: BlockRect,
  fromY: number,
  toY: number,
  group: string,
  trimTop = true,
): void {
  const { rec, layout } = ctx;
  for (let z = rect.z1; z <= rect.z2; z++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      rec.place(x, layout.cityGroundY + 1, z, foundationAt(ctx, x, z), "foundation", group);
      for (let y = fromY; y <= toY; y++) {
        const top = trimTop && y === toY;
        rec.place(x, y, z, top ? wallTrimAt(ctx, x, z) : wallAt(ctx, x, y, z), top ? "details" : "walls", group);
      }
    }
  }
}

function battlements(ctx: LandmarkContext, rect: BlockRect, y: number, group: string): void {
  const { rec } = ctx;
  for (let x = rect.x1; x <= rect.x2; x++) {
    if ((x + rect.z1) % 2 === 0) rec.place(x, y, rect.z1, wallTrimAt(ctx, x, rect.z1), "details", group);
    if ((x + rect.z2) % 2 === 0) rec.place(x, y, rect.z2, wallTrimAt(ctx, x, rect.z2), "details", group);
  }
  for (let z = rect.z1 + 1; z < rect.z2; z++) {
    if ((z + rect.x1) % 2 === 0) rec.place(rect.x1, y, z, wallTrimAt(ctx, rect.x1, z), "details", group);
    if ((z + rect.x2) % 2 === 0) rec.place(rect.x2, y, z, wallTrimAt(ctx, rect.x2, z), "details", group);
  }
}

function carvePassage(
  ctx: LandmarkContext,
  rect: BlockRect,
  axis: "x" | "z",
  height: number,
  group: string,
): void {
  const { rec, layout } = ctx;
  const inset = Math.max(1, Math.floor(layout.cellSize / 2));
  const archTop = layout.cityGroundY + height;
  if (axis === "z") {
    const cx = Math.floor((rect.x1 + rect.x2) / 2);
    const half = Math.max(1, Math.floor(layout.cellSize / 2) - 1 + inset - 1);
    for (let z = rect.z1; z <= rect.z2; z++) {
      for (let x = cx - half; x <= cx + half; x++) {
        for (let y = layout.cityGroundY + 1; y <= archTop; y++) {
          rec.place(x, y, z, "minecraft:air", "details", group);
        }
      }
      rec.place(cx - half - 1, archTop + 1, z, wallTrimAt(ctx, cx - half - 1, z), "details", group);
      rec.place(cx + half + 1, archTop + 1, z, wallTrimAt(ctx, cx + half + 1, z), "details", group);
    }
  } else {
    const cz = Math.floor((rect.z1 + rect.z2) / 2);
    const half = Math.max(1, Math.floor(layout.cellSize / 2) - 1 + inset - 1);
    for (let x = rect.x1; x <= rect.x2; x++) {
      for (let z = cz - half; z <= cz + half; z++) {
        for (let y = layout.cityGroundY + 1; y <= archTop; y++) {
          rec.place(x, y, z, "minecraft:air", "details", group);
        }
      }
      rec.place(x, archTop + 1, cz - half - 1, wallTrimAt(ctx, x, cz - half - 1), "details", group);
      rec.place(x, archTop + 1, cz + half + 1, wallTrimAt(ctx, x, cz + half + 1), "details", group);
    }
  }
}

function gatehouse(
  ctx: LandmarkContext,
  rect: BlockRect,
  height: number,
  axis: "x" | "z",
  group: string,
): number {
  const top = ctx.layout.cityGroundY + 1 + height;
  shade(ctx, rect, ctx.layout.cityGroundY + 2, top, group);
  battlements(ctx, rect, top + 1, group);
  carvePassage(ctx, rect, axis, 5, group);
  // An iron portcullis bar, deep inside the passage, is side-facing detail.
  const midX = Math.floor((rect.x1 + rect.x2) / 2);
  const midZ = Math.floor((rect.z1 + rect.z2) / 2);
  const doorBlock = wallTrimAt(ctx, midX, midZ);
  if (axis === "z") {
    for (let x = midX - 1; x <= midX + 1; x++) {
      ctx.rec.place(x, ctx.layout.cityGroundY + 5, rect.z2, doorBlock, "details", group);
    }
  } else {
    for (let z = midZ - 1; z <= midZ + 1; z++) {
      ctx.rec.place(rect.x2, ctx.layout.cityGroundY + 5, z, doorBlock, "details", group);
    }
  }
  return top + 2;
}

function stainingWindows(
  ctx: LandmarkContext,
  rect: BlockRect,
  ys: number[],
  group: string,
): void {
  const { rec } = ctx;
  for (const y of ys) {
    for (let x = rect.x1 + 1; x <= rect.x2 - 1; x += 2) {
      rec.place(x, y, rect.z1, windowAt(ctx, x, rect.z1), "details", group);
      rec.place(x, y, rect.z2, windowAt(ctx, x, rect.z2), "details", group);
    }
    for (let z = rect.z1 + 1; z <= rect.z2 - 1; z += 2) {
      rec.place(rect.x1, y, z, windowAt(ctx, rect.x1, z), "details", group);
      rec.place(rect.x2, y, z, windowAt(ctx, rect.x2, z), "details", group);
    }
  }
}

function addNeedle(ctx: LandmarkContext, x: number, z: number, fromY: number, height: number, group: string): number {
  for (let i = 0; i < height; i++) {
    ctx.rec.place(x, fromY + i, z, roofAt(ctx, x, z, 2 + i), "roofs", group);
  }
  ctx.rec.place(x, fromY + height, z, roofCapAt(ctx, x, z), "roofs", group);
  return fromY + height;
}

function buildHighKeep(ctx: LandmarkContext): LandmarkResult {
  const origin = originFor(ctx.layout.qr, 0);
  const cell = ctx.layout.cellSize;
  const groupTowers = "castle-towers";
  const groupWalls = "castle-walls";
  const groupKeep = "castle-keep";
  const groupGate = "castle-gate";

  const corners: Array<[number, number]> = [
    [0, 0],
    [0, 5],
    [5, 0],
    [5, 5],
  ];
  let topY = ctx.layout.cityGroundY;
  const keepScale = focusScale(ctx, "keep");
  for (const [r, c] of corners) {
    const rect = modules(ctx.layout, origin, r, c, r + 1, c + 1);
    const result = buildTower(ctx, rect, {
      group: groupTowers,
      height: Math.round((18 + ctx.rng.int(0, 4) + cell) * keepScale),
    });
    topY = Math.max(topY, result.topY);
    addNeedle(ctx, Math.floor((rect.x1 + rect.x2) / 2), Math.floor((rect.z1 + rect.z2) / 2), result.topY, 2, groupTowers);
  }

  const wallSegments: Array<[number, number, number, number]> = [
    [0, 2, 0, 4],
    [2, 0, 4, 0],
    [2, 6, 4, 6],
  ];
  for (const [r1, c1, r2, c2] of wallSegments) {
    const rect = modules(ctx.layout, origin, r1, c1, r2, c2);
    const top = ctx.layout.cityGroundY + 10;
    shade(ctx, rect, ctx.layout.cityGroundY + 2, top, groupWalls);
    battlements(ctx, rect, top + 1, groupWalls);
    topY = Math.max(topY, top + 2);
  }

  // South curtain + gatehouse.
  const gateRect = modules(ctx.layout, origin, 5, 2, 6, 4);
  gatehouse(ctx, gateRect, 15, "z", groupGate);
  topY = Math.max(topY, ctx.layout.cityGroundY + 18);
  // The gatehouse's central mass is the connection between the two piers.
  const gateCore = modules(ctx.layout, origin, 5, 3, 6, 3);
  shade(ctx, gateCore, ctx.layout.cityGroundY + 2, ctx.layout.cityGroundY + 15, groupGate);
  battlements(ctx, gateCore, ctx.layout.cityGroundY + 16, groupGate);

  // Main keep: a broad base with a styled upper tower and steep roof.
  const keepBase = modules(ctx.layout, origin, 2, 2, 4, 4);
  const keepWallTop = ctx.layout.cityGroundY + Math.round(18 * keepScale);
  shade(ctx, keepBase, ctx.layout.cityGroundY + 2, keepWallTop, groupKeep);
  battlements(ctx, keepBase, keepWallTop + 1, groupKeep);
  stainingWindows(ctx, keepBase, [keepWallTop - 7, keepWallTop - 2], groupKeep);
  landmarkDetail(ctx, keepBase, keepWallTop + 1, groupKeep);
  topY = Math.max(topY, keepWallTop + 2);

  const inset = Math.max(1, Math.floor(cell / 2));
  const upper: BlockRect = {
    x1: keepBase.x1 + inset,
    z1: keepBase.z1 + inset,
    x2: keepBase.x2 - inset,
    z2: keepBase.z2 - inset,
  };
  const upperBase = keepWallTop + 2;
  const upperTop = upperBase + Math.round(8 * keepScale);
  shade(ctx, upper, upperBase, upperTop, groupKeep);
  // Windows on the upper keep are on wall planes and get covered by the roof.
  stainingWindows(ctx, upper, [upperBase + 3, upperTop - 2], groupKeep);

  const upperRoof = raiseRoof(ctx, upper, upperTop, groupKeep);
  const centerX = Math.floor((upper.x1 + upper.x2) / 2);
  const centerZ = Math.floor((upper.z1 + upper.z2) / 2);
  const roofTop = addNeedle(ctx, centerX, centerZ, upperRoof.topY + 1, 4, groupKeep);
  topY = Math.max(topY, roofTop);

  // A ceremonial banner mast in the courtyard, built only from class-correct blocks.
  const courtX = keepBase.x1 - Math.max(2, Math.floor(cell / 2));
  const courtZ = Math.floor((keepBase.z1 + keepBase.z2) / 2);
  if (courtX > ctx.layout.cityRect.x1) {
    for (let y = ctx.layout.cityGroundY + 1; y <= ctx.layout.cityGroundY + 12; y++) {
      ctx.rec.place(courtX, y, courtZ, wallTrimAt(ctx, courtX, courtZ), "details", groupKeep);
    }
    ctx.rec.place(courtX, ctx.layout.cityGroundY + 13, courtZ, roofCapAt(ctx, courtX, courtZ), "details", groupKeep);
  }

  return { id: "high-keep", label: siteOf(ctx).landmarks.labels.keep, topY };
}

function buildCathedral(ctx: LandmarkContext): LandmarkResult {
  const origin = originFor(ctx.layout.qr, 2);
  const groupTowers = "cathedral-towers";
  const groupNave = "cathedral-nave";
  const groupSpire = "cathedral-spire";
  const groupButtress = "cathedral-buttresses";
  let topY = ctx.layout.cityGroundY;

  const towerRects = [
    modules(ctx.layout, origin, 0, 0, 1, 1),
    modules(ctx.layout, origin, 5, 0, 6, 1),
  ];
  const cathedralScale = focusScale(ctx, "cathedral");
  for (const rect of towerRects) {
    const tower = buildTower(ctx, rect, {
      group: groupTowers,
      height: Math.round(26 * cathedralScale),
    });
    const cx = Math.floor((rect.x1 + rect.x2) / 2);
    const cz = Math.floor((rect.z1 + rect.z2) / 2);
    const needleTop = addNeedle(ctx, cx, cz, tower.topY, 5, groupTowers);
    topY = Math.max(topY, needleTop);
  }

  // West portal between the towers.
  const portal = modules(ctx.layout, origin, 2, 0, 4, 1);
  const portalBuilding: BuildingContext = {
    ...ctx,
    baseY: ctx.layout.cityGroundY,
    rng: ctx.rng,
  };
  const portalResult = buildHouse(portalBuilding, portal, {
    group: groupNave,
    doorSide: "west",
    wallHeight: 12,
  });
  topY = Math.max(topY, portalResult.topY);
  for (let z = portal.z1 + 1; z <= portal.z2 - 1; z++) {
    ctx.rec.place(
      portal.x1,
      ctx.layout.cityGroundY + 11,
      z,
      windowAt(ctx, portal.x1, z),
      "details",
      groupNave,
    );
  }

  // Nave with a style-driven high roof running east-west.
  const nave: BlockRect = modules(ctx.layout, origin, 1, 2, 5, 5);
  const naveTop = ctx.layout.cityGroundY + Math.round(20 * Math.sqrt(cathedralScale));
  shade(ctx, nave, ctx.layout.cityGroundY + 2, naveTop, groupNave);
  stainingWindows(ctx, nave, [naveTop - 7, naveTop - 2], groupNave);
  const naveRoof = raiseRoof(ctx, nave, naveTop, groupNave);
  topY = Math.max(topY, naveRoof.topY);

  // Apse.
  const apse = modules(ctx.layout, origin, 1, 6, 5, 6);
  shade(ctx, apse, ctx.layout.cityGroundY + 2, naveTop - 3, groupNave);
  for (let z = apse.z1; z <= apse.z2; z++) {
    for (let x = apse.x1; x <= apse.x2; x++) {
      ctx.rec.place(x, naveTop - 2, z, roofAt(ctx, x, z, 2), "roofs", groupNave);
      ctx.rec.place(x, naveTop - 1, z, roofAt(ctx, x, z, 3), "roofs", groupNave);
    }
  }

  // Crossing tower and flèche.
  const crossing = modules(ctx.layout, origin, 2, 3, 4, 4);
  const crossingTop = ctx.layout.cityGroundY + Math.round(28 * cathedralScale);
  shade(ctx, crossing, naveTop - 2, crossingTop, groupSpire);
  battlements(ctx, crossing, crossingTop + 1, groupSpire);
  landmarkDetail(ctx, crossing, crossingTop + 1, groupSpire);
  const flècheX = Math.floor((crossing.x1 + crossing.x2) / 2);
  const flècheZ = Math.floor((crossing.z1 + crossing.z2) / 2);
  const flèche = addNeedle(ctx, flècheX, flècheZ, crossingTop + 2, 7, groupSpire);
  topY = Math.max(topY, flèche);

  // Flying buttresses along the nave.
  for (const [z, rz] of [
    [nave.z1, -1],
    [nave.z2, 1],
  ] as Array<[number, number]>) {
    for (let x = nave.x1 + 2; x <= nave.x2 - 2; x += Math.max(3, ctx.layout.cellSize)) {
      const bz = z + rz * Math.max(1, Math.floor(ctx.layout.cellSize / 2));
      for (let y = ctx.layout.cityGroundY + 2; y <= naveTop - 4; y++) {
        ctx.rec.place(x, y, bz, wallAt(ctx, x, y, bz), "walls", groupButtress);
      }
      ctx.rec.place(x, naveTop - 3, bz, wallTrimAt(ctx, x, bz), "details", groupButtress);
    }
  }

  return { id: "cathedral", label: siteOf(ctx).landmarks.labels.cathedral, topY };
}

function buildEastBastion(ctx: LandmarkContext): LandmarkResult {
  const origin = originFor(ctx.layout.qr, 1);
  const groupWalls = "bastion-walls";
  const groupTowers = "bastion-towers";
  const groupDrum = "bastion-drum";
  const groupGate = "bastion-gate";
  const bastionScale = focusScale(ctx, "bastion");
  let topY = ctx.layout.cityGroundY;

  for (const [r, c] of [
    [0, 0],
    [0, 5],
    [5, 0],
    [5, 5],
  ] as Array<[number, number]>) {
    const rect = modules(ctx.layout, origin, r, c, r + 1, c + 1);
    const top = ctx.layout.cityGroundY + Math.round(13 * bastionScale);
    shade(ctx, rect, ctx.layout.cityGroundY + 2, top, groupTowers);
    battlements(ctx, rect, top + 1, groupTowers);
    landmarkDetail(ctx, rect, top + 1, groupTowers);
    const cornerX = c === 0 ? rect.x1 + 1 : rect.x2 - 1;
    const cornerZ = r === 0 ? rect.z1 + 1 : rect.z2 - 1;
    const needle = addNeedle(ctx, cornerX, cornerZ, top + 1, 4, groupTowers);
    topY = Math.max(topY, needle);
  }

  for (const [r1, c1, r2, c2] of [
    [0, 2, 0, 4],
    [2, 6, 4, 6],
    [6, 2, 6, 4],
  ] as Array<[number, number, number, number]>) {
    const rect = modules(ctx.layout, origin, r1, c1, r2, c2);
    const top = ctx.layout.cityGroundY + Math.round(9 * bastionScale);
    shade(ctx, rect, ctx.layout.cityGroundY + 2, top, groupWalls);
    battlements(ctx, rect, top + 1, groupWalls);
    landmarkDetail(ctx, rect, top + 1, groupWalls);
    topY = Math.max(topY, top + 2);
  }

  // West-facing gatehouse.
  const gateRect = modules(ctx.layout, origin, 2, 0, 4, 0);
  const gateTop = gatehouse(ctx, gateRect, Math.round(13 * bastionScale), "x", groupGate);
  topY = Math.max(topY, gateTop);

  // Great drum tower at the heart of the bastion.
  const drumRect = modules(ctx.layout, origin, 2, 2, 4, 4);
  const drum = buildTower(ctx, drumRect, {
    group: groupDrum,
    height: Math.round(25 * bastionScale),
  });
  const drumX = Math.floor((drumRect.x1 + drumRect.x2) / 2);
  const drumZ = Math.floor((drumRect.z1 + drumRect.z2) / 2);
  const drumTop = addNeedle(ctx, drumX, drumZ, drum.topY, 3, groupDrum);
  topY = Math.max(topY, drumTop);

  // Barracks along the inner south wall.
  const barracks = modules(ctx.layout, origin, 5, 2, 5, 3);
  const barracksCtx: BuildingContext = { ...ctx, baseY: ctx.layout.cityGroundY, rng: ctx.rng };
  const barracksResult = buildHouse(barracksCtx, barracks, {
    group: groupTowers,
    doorSide: "north",
    wallHeight: Math.max(4, Math.round(5 * bastionScale)),
  });
  topY = Math.max(topY, barracksResult.topY);

  return { id: "east-bastion", label: siteOf(ctx).landmarks.labels.bastion, topY };
}

export function buildLandmarks(ctx: LandmarkContext): LandmarkResult[] {
  return [buildHighKeep(ctx), buildEastBastion(ctx), buildCathedral(ctx)];
}

export function paintCityGround(ctx: LandmarkContext): void {
  const { layout, rec } = ctx;
  for (let z = layout.cityRect.z1; z <= layout.cityRect.z2; z++) {
    for (let x = layout.cityRect.x1; x <= layout.cityRect.x2; x++) {
      rec.place(
        x,
        layout.cityGroundY,
        z,
        groundAt(ctx, x, z),
        "ground",
        "city-ground",
      );
    }
  }
}
