import type { Complexity, SiteLayout } from "@/lib/world/site";
import { STYLES, type StyleId } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";
import { siteFor } from "@/lib/sites/registry";
import type { PlacementRecorder } from "@/lib/world/recorder";
import type { Rng } from "@/lib/world/rng";
import type { BuildingContext, BuildingResult, DoorSide } from "@/lib/world/buildings";
import { buildHouse, buildManor, buildMarketStall, buildTower } from "@/lib/world/buildings";
import {
  buildLandmarks,
  paintCityGround,
  type LandmarkContext,
  type LandmarkResult,
} from "@/lib/world/landmarks";
import { groundAt, roofCapAt, wallTrimAt } from "@/lib/world/paint";

export interface CityContext {
  rec: PlacementRecorder;
  layout: SiteLayout;
  style: StyleId;
  site: SiteId;
  quality: QualityLevel;
  complexity: Complexity;
  rng: Rng;
}

export interface CityResult {
  landmarks: LandmarkResult[];
  buildings: number;
  towers: number;
  structures: number;
  tallestLandmark: string;
  marketModules: number;
}

const FREE = 0;
const LANDMARK = 1;
const ROAD = 2;
const BUILDING = 3;
const MARKET = 4;

interface Plot {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

const moduleCell = (layout: SiteLayout, row: number, col: number) => ({
  x1: layout.cityX + col * layout.cellSize,
  z1: layout.cityZ + row * layout.cellSize,
  x2: layout.cityX + (col + 1) * layout.cellSize - 1,
  z2: layout.cityZ + (row + 1) * layout.cellSize - 1,
});

function markMask(mask: Uint8Array, n: number, plot: Plot, value: number): void {
  for (let r = plot.row; r < plot.row + plot.rows; r++) {
    for (let c = plot.col; c < plot.col + plot.cols; c++) {
      mask[r * n + c] = value;
    }
  }
}

function regionFree(mask: Uint8Array, n: number, plot: Plot, within: { min: number; max: number }): boolean {
  if (plot.row < within.min || plot.col < within.min) return false;
  if (plot.row + plot.rows > within.max || plot.col + plot.cols > within.max) return false;
  for (let r = plot.row; r < plot.row + plot.rows; r++) {
    for (let c = plot.col; c < plot.col + plot.cols; c++) {
      if (mask[r * n + c] !== FREE) return false;
    }
  }
  return true;
}

function paintRoad(ctx: CityContext, row: number, col: number): void {
  const { layout, rec } = ctx;
  const cell = moduleCell(layout, row, col);
  const dark = layout.qr.data[row * layout.qr.size + col] === 1;
  for (let z = cell.z1; z <= cell.z2; z++) {
    for (let x = cell.x1; x <= cell.x2; x++) {
      const variant = Math.abs(x * 3 + z * 7) % 7;
      const material = dark
        ? variant < 2
          ? "minecraft:polished_deepslate"
          : variant < 5
            ? "minecraft:deepslate_tiles"
            : "minecraft:cobbled_deepslate"
        : variant < 2
          ? "minecraft:smooth_quartz"
          : variant < 5
            ? "minecraft:calcite"
            : "minecraft:polished_diorite";
      rec.place(x, layout.cityGroundY, z, material, "ground", "city-roads");
    }
  }
}

function doorSideFor(
  mask: Uint8Array,
  n: number,
  plot: Plot,
): DoorSide {
  const south = plot.row + plot.rows;
  const east = plot.col + plot.cols;
  const checks: Array<{ side: DoorSide; row: number; col: number }> = [
    { side: "south", row: south, col: plot.col + Math.floor(plot.cols / 2) },
    { side: "north", row: plot.row - 1, col: plot.col + Math.floor(plot.cols / 2) },
    { side: "west", row: plot.row + Math.floor(plot.rows / 2), col: plot.col - 1 },
    { side: "east", row: plot.row + Math.floor(plot.rows / 2), col: east },
  ];
  for (const check of checks) {
    if (check.row < 0 || check.col < 0 || check.row >= n || check.col >= n) continue;
    const value = mask[check.row * n + check.col];
    if (value === ROAD || value === MARKET) return check.side;
  }
  return "south";
}

function buildMarket(
  ctx: CityContext,
  mask: Uint8Array,
  n: number,
  qz: number,
  market: Plot,
): { stalls: number; buildings: BuildingResult[] } {
  const buildings: BuildingResult[] = [];
  let stalls = 0;
  const buildingCtx: BuildingContext = {
    rec: ctx.rec,
    layout: ctx.layout,
    style: ctx.style,
    site: ctx.site,
    quality: ctx.quality,
    detailing: siteFor(ctx.site).city.detailing,
    complexity: ctx.complexity,
    rng: ctx.rng,
    baseY: ctx.layout.cityGroundY,
  };
  const perimeter: Array<[number, number]> = [];
  for (let c = 0; c < market.cols; c++) {
    perimeter.push([0, c]);
    perimeter.push([market.rows - 1, c]);
  }
  for (let r = 1; r < market.rows - 1; r++) {
    perimeter.push([r, 0], [r, market.cols - 1]);
  }
  for (const [dr, dc] of perimeter) {
    if ((dr + dc) % 2 !== 0) continue;
    const row = market.row + dr;
    const col = market.col + dc;
    const cell = moduleCell(ctx.layout, row, col);
    const result = buildMarketStall(buildingCtx, cell, { group: "market-stalls" });
    buildings.push(result);
    stalls++;
  }
  // Central monument, built from class-correct materials.
  const centerRow = market.row + Math.floor(market.rows / 2);
  const centerCol = market.col + Math.floor(market.cols / 2);
  const center = moduleCell(ctx.layout, centerRow, centerCol);
  const cx1 = center.x1 + 1;
  const cx2 = center.x2 - 1;
  const cz1 = center.z1 + 1;
  const cz2 = center.z2 - 1;
  const midX = Math.floor((cx1 + cx2) / 2);
  const midZ = Math.floor((cz1 + cz2) / 2);
  for (let z = cz1; z <= cz2; z++) {
    for (let x = cx1; x <= cx2; x++) {
      ctx.rec.place(x, ctx.layout.cityGroundY + 1, z, wallTrimAt(ctx, x, z), "details", "market-monument");
      ctx.rec.place(x, ctx.layout.cityGroundY, z, groundAt(ctx, x, z), "ground", "market-monument");
    }
  }
  for (let y = ctx.layout.cityGroundY + 2; y <= ctx.layout.cityGroundY + 7; y++) {
    ctx.rec.place(midX, y, midZ, wallTrimAt(ctx, midX, midZ), "walls", "market-monument");
  }
  ctx.rec.place(midX, ctx.layout.cityGroundY + 8, midZ, roofCapAt(ctx, midX, midZ), "roofs", "market-monument");
  for (const [x, z] of [
    [cx1, cz1],
    [cx1, cz2],
    [cx2, cz1],
    [cx2, cz2],
  ]) {
    ctx.rec.place(x, ctx.layout.cityGroundY + 2, z, wallTrimAt(ctx, x, z), "details", "market-monument");
  }
  // Light trims around the square; all at ground level, all class-correct.
  for (let c = market.col; c < market.col + market.cols; c++) {
    for (const row of [market.row, market.row + market.rows - 1]) {
      const cell = moduleCell(ctx.layout, row, c);
      for (let x = cell.x1; x <= cell.x2; x++) {
        ctx.rec.place(x, ctx.layout.cityGroundY, cell.z1, groundAt(ctx, x, cell.z1), "ground", "market-plaza");
        ctx.rec.place(x, ctx.layout.cityGroundY, cell.z2, groundAt(ctx, x, cell.z2), "ground", "market-plaza");
      }
    }
  }
  markMask(mask, n, market, MARKET);
  void qz;
  return { stalls, buildings };
}

export function buildCity(ctx: CityContext): CityResult {
  const { layout } = ctx;
  const site = siteFor(ctx.site);
  const rules = site.city;
  const style = STYLES[ctx.style];
  const roadSpacing = Math.max(3, Math.round(rules.roadSpacing));
  const density = Math.max(0.35, Math.min(1.5, rules.density));
  const n = layout.qr.size;
  const qz = layout.qr.quietZone;
  const mask = new Uint8Array(n * n);
  const landmarkCtx: LandmarkContext = {
    rec: ctx.rec,
    layout,
    style: ctx.style,
    site: ctx.site,
    quality: ctx.quality,
    detailing: rules.detailing,
    landmarkScale: rules.landmarkScale,
    complexity: ctx.complexity,
    rng: ctx.rng,
    baseY: layout.cityGroundY,
  };

  paintCityGround(landmarkCtx);

  // Quiet zone and finder footprints are preserved for the QR.
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const quiet = r < qz || c < qz || r >= n - qz || c >= n - qz;
      if (quiet) mask[r * n + c] = LANDMARK;
    }
  }
  const finders: Array<{ row: number; col: number }> = [
    { row: qz, col: qz },
    { row: qz, col: n - qz - 7 },
    { row: n - qz - 7, col: qz },
  ];
  for (const finder of finders) {
    for (let r = finder.row; r < finder.row + 7; r++) {
      for (let c = finder.col; c < finder.col + 7; c++) {
        mask[r * n + c] = LANDMARK;
      }
    }
    // A one-module plaza ring gives each landmark breathing room.
    for (let r = finder.row - 1; r <= finder.row + 7; r++) {
      for (let c = finder.col - 1; c <= finder.col + 7; c++) {
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        if (mask[r * n + c] === LANDMARK) continue;
        mask[r * n + c] = ROAD;
        paintRoad(ctx, r, c);
      }
    }
  }

  const landmarks = buildLandmarks(landmarkCtx);

  // Street grid through the districts.
  for (let r = qz; r < n - qz; r++) {
    for (let c = qz; c < n - qz; c++) {
      if (mask[r * n + c] !== FREE) continue;
      if ((r - qz) % roadSpacing === 0 || (c - qz) % roadSpacing === 0) {
        mask[r * n + c] = ROAD;
        paintRoad(ctx, r, c);
      }
    }
  }

  // Market square near the center of the free city.
  let market: Plot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let r = qz + 1; r <= n - qz - 5; r++) {
    for (let c = qz + 1; c <= n - qz - 5; c++) {
      const plot: Plot = { row: r, col: c, rows: 4, cols: 4 };
      let blocked = false;
      for (let rr = r; rr < r + 4 && !blocked; rr++) {
        for (let cc = c; cc < c + 4; cc++) {
          if (mask[rr * n + cc] === LANDMARK) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) continue;
      const distance = Math.hypot(r + 2 - n / 2, c + 2 - n / 2);
      if (distance < bestDistance) {
        bestDistance = distance;
        market = plot;
      }
    }
  }
  let marketStalls = 0;
  if (market && rules.market) {
    const result = buildMarket(ctx, mask, n, qz, market);
    marketStalls = result.stalls;
  }

  // Processional avenue from the south gate to the market square. Two modules
  // wide, so the eye can follow the bridge into the city.
  const avenueCol = Math.max(qz + 1, Math.min(n - qz - 3, Math.floor(n / 2) - 1));
  const avenueStart = market ? market.row + market.rows : Math.floor(n / 2);
  for (let r = avenueStart; r <= n - qz - 1; r++) {
    for (let c = avenueCol; c <= avenueCol + 1; c++) {
      if (mask[r * n + c] !== FREE) continue;
      mask[r * n + c] = ROAD;
      paintRoad(ctx, r, c);
    }
  }

  const buildingCtx: BuildingContext = {
    rec: ctx.rec,
    layout,
    style: ctx.style,
    site: ctx.site,
    quality: ctx.quality,
    detailing: rules.detailing,
    complexity: ctx.complexity,
    rng: ctx.rng,
    baseY: layout.cityGroundY,
  };
  const sizes: Array<[number, number]> = [
    [3, 3],
    [3, 2],
    [2, 3],
    [2, 2],
    [2, 1],
    [1, 2],
  ];
  let buildings = 0;
  let towers = 0;
  const min = qz + 1;
  const max = n - qz - 1;
  for (let r = min; r < max; r++) {
    for (let c = min; c < max; c++) {
      if (mask[r * n + c] !== FREE) continue;
      // Low-density sites leave deliberate clearings rather than shrinking
      // every building into the same footprint. The ground beneath is already
      // painted from class-correct materials.
      if (density < 0.99 && ctx.rng.chance(1 - density)) {
        mask[r * n + c] = ROAD;
        continue;
      }
      let chosen: Plot | null = null;
      for (const [rows, cols] of ctx.rng.shuffle([...sizes])) {
        const plot: Plot = { row: r, col: c, rows, cols };
        if (regionFree(mask, n, plot, { min, max })) {
          chosen = plot;
          break;
        }
      }
      if (!chosen) continue;
      const doorSide = doorSideFor(mask, n, chosen);
      const cell = moduleCell(layout, chosen.row, chosen.col);
      const rect = {
        x1: cell.x1,
        z1: cell.z1,
        x2: moduleCell(layout, chosen.row + chosen.rows - 1, chosen.col + chosen.cols - 1).x2,
        z2: moduleCell(layout, chosen.row + chosen.rows - 1, chosen.col + chosen.cols - 1).z2,
      };
      const groupBase =
        chosen.rows >= 3 && chosen.cols >= 3
          ? `manor-${buildings}`
          : chosen.rows === 1 || chosen.cols === 1
            ? `rowhouse-${buildings}`
            : `house-${buildings}`;
      let result: BuildingResult;
      const broad = chosen.rows >= 2 && chosen.cols >= 2;
      if (chosen.rows >= 3 && chosen.cols >= 3 && ctx.complexity !== "serene") {
        result = buildManor(buildingCtx, rect, { group: groupBase, doorSide });
      } else if (
        broad &&
        ctx.rng.chance(
          (ctx.complexity === "dense" ? 0.055 : 0.025) *
            style.proportions.towerBias *
            rules.towerBias *
            (ctx.quality === "showcase" ? 1.25 : ctx.quality === "standard" ? 0.8 : 1),
        )
      ) {
        result = buildTower(buildingCtx, rect, {
          group: groupBase,
          height: Math.round((9 + ctx.rng.int(0, 4)) * (ctx.quality === "showcase" ? 1.2 : 1)),
        });
      } else {
        result = buildHouse(buildingCtx, rect, {
          group: groupBase,
          doorSide,
          wallHeight:
            chosen.rows === 1 || chosen.cols === 1
              ? 4
              : ctx.complexity === "serene"
                ? 4
                : 5 + ctx.rng.int(0, 2),
        });
      }
      markMask(mask, n, chosen, BUILDING);
      buildings += 1;
      towers += result.towers;
    }
  }

  // Processional approach across the southern esplanade, using only light
  // materials because it brushes the quiet zone.
  const half = Math.floor(layout.bridgeWidth / 2);
  for (let z = layout.cityRect.z2 + 1; z <= layout.plateauRect.z2; z++) {
    for (let x = layout.centerX - half; x <= layout.centerX + half; x++) {
      const material =
        (x + z) % 9 === 0 ? "minecraft:smooth_quartz" : (x + z) % 5 === 0 ? "minecraft:polished_diorite" : "minecraft:calcite";
      ctx.rec.place(x, layout.cityGroundY, z, material, "ground", "city-approach");
    }
  }

  const structures = buildings + 3 + marketStalls;
  const tallest = landmarks.reduce((best, landmark) => (landmark.topY > best.topY ? landmark : best), landmarks[0]);
  return {
    landmarks,
    buildings,
    towers,
    structures,
    tallestLandmark: tallest.label,
    marketModules: market ? 16 : 0,
  };
}
