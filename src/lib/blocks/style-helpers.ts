import type {
  DetailGrammar,
  DoorGrammar,
  DoorType,
  LightingGrammar,
  LightingKind,
  MaterialSet,
  OrnamentType,
  RoofGrammar,
  RoofType,
  StructuralPalette,
  StyleDefinition,
  StyleProportions,
  WallGrammar,
  WallType,
  WindowGrammar,
  WindowType,
} from "@/lib/blocks/style-types";

export const ms = (set: MaterialSet): MaterialSet => set;

export const roof = (
  type: RoofType,
  pitch: number,
  eaves: boolean,
  ornament: OrnamentType,
): RoofGrammar => ({ type, pitch, eaves, ornament });

export const wall = (
  type: WallType,
  banding: WallGrammar["banding"],
  buttresses = 0,
  pilasters = false,
): WallGrammar => ({ type, banding, buttresses, pilasters });

export const windows = (
  type: WindowType,
  width: 1 | 2 = 1,
  spacing: 1 | 2 | 3 = 2,
  shutters = false,
  bars = false,
): WindowGrammar => ({ type, width, spacing, shutters, bars });

export const doors = (type: DoorType, height: 2 | 3 = 2, frame = true): DoorGrammar => ({
  type,
  height,
  frame,
});

export const detail = (partial: Partial<DetailGrammar>): DetailGrammar => ({
  chimneys: false,
  dormers: false,
  balconies: false,
  banners: false,
  planters: false,
  columns: false,
  arches: false,
  weathering: 0.1,
  ...partial,
});

export const proportions = (
  wallHeight: number,
  roofPitch: number,
  towerBias: number,
): StyleProportions => ({ wallHeight, roofPitch, towerBias });

export const lighting = (kind: LightingKind, density: number): LightingGrammar => ({
  kind,
  density,
});

export const structure = (
  wallSet: readonly string[],
  foundation: string,
  darkWall?: readonly string[],
  lightWall?: readonly string[],
  darkFoundation?: string,
  lightFoundation?: string,
): StructuralPalette => ({
  wall: wallSet,
  foundation,
  darkWall,
  lightWall,
  darkFoundation,
  lightFoundation,
});

type StyleSeed = Omit<StyleDefinition, "version">;

export const defineStyle = (seed: StyleSeed): StyleDefinition => ({
  ...seed,
  version: 2,
});
