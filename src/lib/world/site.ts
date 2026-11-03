import type { QRMatrix } from "@/lib/qr/matrix";
import type { StyleId } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";

export const SITE_SIZES = [128, 192, 256, 320] as const;
export type SiteSize = (typeof SITE_SIZES)[number];

export const COMPLEXITIES = ["serene", "balanced", "dense"] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

export interface WorldConfig {
  payload: string;
  seed: number;
  size: SiteSize;
  site: SiteId;
  style: StyleId;
  quality: QualityLevel;
  complexity: Complexity;
}

export const GENERATION_VERSION = 2;

export interface WorldSizeChoice {
  size: SiteSize;
  upgraded: boolean;
  /** True when the site's own minimum size raised the requested size. */
  minimumForced: boolean;
  /** True when reserving a landscape band raised the selected size. */
  landscapeForced: boolean;
  cellSize: number;
}

export const SITE_LABELS: Record<SiteSize, string> = {
  128: "Hamlet",
  192: "Kingdom",
  256: "Grand Kingdom",
  320: "Monumental",
};

const MIN_CELL = 3;
const MAX_CELL = 7;
const SIDE_MARGIN = 18;
const ESPLANADE = 6;
const MOAT_WIDTH = 6;
/**
 * Landscape width reserved outside the moat for V2 outer landmarks. Legacy
 * sites reserve nothing so their V1 layouts stay byte-for-byte unchanged.
 */
export const FEATURE_LANDSCAPE_BAND = 12;

export interface Rect {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface SiteLayout {
  worldSize: SiteSize;
  worldHeight: number;
  qr: QRMatrix;
  cellSize: number;
  citySize: number;
  cityX: number;
  cityZ: number;
  cityRect: Rect;
  plateauRect: Rect;
  moatRect: Rect;
  esplanadeWidth: number;
  moatWidth: number;
  waterY: number;
  plateauTopY: number;
  cityGroundY: number;
  bridgeY: number;
  bridgeWidth: number;
  spawn: { x: number; y: number; z: number };
  centerX: number;
  centerZ: number;
}

export function chooseWorldSize(
  qr: QRMatrix,
  requested: SiteSize,
  minimumRequested: SiteSize = requested,
  landscapeBand = 0,
): WorldSizeChoice {
  const target = Math.max(requested, minimumRequested);
  const standardMinimum = qr.size * MIN_CELL + SIDE_MARGIN * 2;
  const band = Math.max(0, landscapeBand);
  const bandedMinimum = standardMinimum + band * 2;
  const fits = (minimum: number): SiteSize | null =>
    SITE_SIZES.find((candidate) => candidate >= target && candidate >= minimum) ?? null;
  const standardSize = fits(standardMinimum);
  const bandedSize = fits(bandedMinimum);
  const available = bandedSize ?? standardSize;
  if (!available) {
    throw new Error(
      `This QR code needs a world at least ${Math.max(standardMinimum, target)} blocks wide. Shorten the payload or use a smaller error-correction level.`,
    );
  }
  // When even the largest site cannot hold the preferred landscape band, keep
  // the payload's original maximum cell size and let the brief omit features
  // that do not fit rather than rejecting a payload the V1 site could hold.
  const reserved = bandedSize !== null ? bandedMinimum : standardMinimum;
  const cellSize = Math.max(
    MIN_CELL,
    Math.min(MAX_CELL, Math.floor((available - (reserved - qr.size * MIN_CELL)) / qr.size)),
  );
  return {
    size: available,
    upgraded: available !== requested,
    minimumForced: minimumRequested > requested,
    landscapeForced:
      bandedSize !== null && standardSize !== null && bandedSize !== standardSize,
    cellSize,
  };
}

const rect = (x1: number, z1: number, x2: number, z2: number): Rect => ({ x1, z1, x2, z2 });

export function createSiteLayout(
  qr: QRMatrix,
  requested: SiteSize,
  minimumRequested: SiteSize = requested,
  landscapeBand = 0,
): SiteLayout {
  const { size, cellSize } = chooseWorldSize(qr, requested, minimumRequested, landscapeBand);
  const citySize = qr.size * cellSize;
  const cityX = Math.floor((size - citySize) / 2);
  const cityZ = Math.floor((size - citySize) / 2);
  const cityRect = rect(cityX, cityZ, cityX + citySize - 1, cityZ + citySize - 1);
  const plateauRect = rect(
    cityRect.x1 - ESPLANADE,
    cityRect.z1 - ESPLANADE,
    cityRect.x2 + ESPLANADE,
    cityRect.z2 + ESPLANADE,
  );
  const moatRect = rect(
    plateauRect.x1 - MOAT_WIDTH,
    plateauRect.z1 - MOAT_WIDTH,
    plateauRect.x2 + MOAT_WIDTH,
    plateauRect.z2 + MOAT_WIDTH,
  );
  if (
    moatRect.x1 < 2 ||
    moatRect.z1 < 2 ||
    moatRect.x2 > size - 3 ||
    moatRect.z2 > size - 3
  ) {
    throw new Error("The city margin does not fit inside the world. Choose a larger site.");
  }

  const centerX = Math.floor((cityRect.x1 + cityRect.x2) / 2);
  const centerZ = Math.floor((cityRect.z1 + cityRect.z2) / 2);
  const bridgeY = 20;

  return {
    worldSize: size,
    worldHeight: 84,
    qr,
    cellSize,
    citySize,
    cityX,
    cityZ,
    cityRect,
    plateauRect,
    moatRect,
    esplanadeWidth: ESPLANADE,
    moatWidth: MOAT_WIDTH,
    waterY: 16,
    plateauTopY: 19,
    cityGroundY: 20,
    bridgeY,
    bridgeWidth: 8,
    spawn: {
      x: centerX + 0.5,
      y: bridgeY + 2.6,
      z: moatRect.z2 + 4.5,
    },
    centerX,
    centerZ,
  };
}

export function moduleWorldRect(
  layout: SiteLayout,
  row: number,
  col: number,
): Rect {
  const x1 = layout.cityX + col * layout.cellSize;
  const z1 = layout.cityZ + row * layout.cellSize;
  return rect(
    x1,
    z1,
    x1 + layout.cellSize - 1,
    z1 + layout.cellSize - 1,
  );
}

export function worldToModule(layout: SiteLayout, x: number, z: number): { row: number; col: number } {
  return {
    row: Math.floor((z - layout.cityZ) / layout.cellSize),
    col: Math.floor((x - layout.cityX) / layout.cellSize),
  };
}

export function insideRect(x: number, z: number, area: Rect): boolean {
  return x >= area.x1 && x <= area.x2 && z >= area.z1 && z <= area.z2;
}

export function rectCenter(area: Rect): { x: number; z: number } {
  return {
    x: Math.floor((area.x1 + area.x2) / 2),
    z: Math.floor((area.z1 + area.z2) / 2),
  };
}
