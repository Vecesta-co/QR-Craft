export type ProjectionClass = "dark" | "light" | "neutral";

export type RoofType =
  | "stepped"
  | "gable"
  | "hip"
  | "flat"
  | "dome"
  | "pagoda"
  | "spire"
  | "sawtooth"
  | "clerestory"
  | "ruined";

export type WallType =
  | "solid"
  | "buttressed"
  | "timber"
  | "arcade"
  | "rusticated"
  | "panelled"
  | "pilastered"
  | "overgrown";

export type WindowType =
  | "lancet"
  | "round"
  | "grid"
  | "slit"
  | "oriel"
  | "arched"
  | "rose"
  | "shoji"
  | "ruined";

export type DoorType =
  | "arched"
  | "double"
  | "gate"
  | "portcullis"
  | "round"
  | "timber"
  | "screen";

export type OrnamentType =
  | "battlements"
  | "spires"
  | "gables"
  | "domes"
  | "eaves"
  | "brass"
  | "crystal"
  | "ivy"
  | "banners"
  | "none";

export type LightingKind = "lantern" | "torch" | "soul" | "glow" | "crystal" | "none";

export interface MaterialSet {
  ground: readonly string[];
  foundation: string;
  wall: readonly string[];
  roof: readonly string[];
  roofEdge: string;
  trim: string;
  accent: string;
  window: string;
  door: string;
  /** Side-facing metal ornament. Never used for a QR-relevant top surface. */
  metal?: string;
}

export interface StructuralPalette {
  wall: readonly string[];
  foundation: string;
  /** Optional QR-class-specific wall family. Walls are side-facing, so these are
   * free to differ without affecting the top projection. */
  darkWall?: readonly string[];
  lightWall?: readonly string[];
  darkFoundation?: string;
  lightFoundation?: string;
}

export interface ThemePalette {
  dark: MaterialSet;
  light: MaterialSet;
}

export interface RoofGrammar {
  type: RoofType;
  pitch: number;
  eaves: boolean;
  ornament: OrnamentType;
}

export interface WallGrammar {
  type: WallType;
  banding: "none" | "stone" | "timber" | "brick" | "plaster" | "crystal";
  buttresses: number;
  pilasters: boolean;
}

export interface WindowGrammar {
  type: WindowType;
  width: 1 | 2;
  spacing: 1 | 2 | 3;
  shutters: boolean;
  bars: boolean;
}

export interface DoorGrammar {
  type: DoorType;
  height: 2 | 3;
  frame: boolean;
}

export interface DetailGrammar {
  chimneys: boolean;
  dormers: boolean;
  balconies: boolean;
  banners: boolean;
  planters: boolean;
  columns: boolean;
  arches: boolean;
  weathering: number;
}

export interface StyleProportions {
  wallHeight: number;
  roofPitch: number;
  towerBias: number;
}

export interface LightingGrammar {
  kind: LightingKind;
  density: number;
}

export interface StyleDefinition {
  id: string;
  label: string;
  description: string;
  category: string;
  swatches: readonly [string, string, string];
  palette: ThemePalette;
  structure: StructuralPalette;
  roof: RoofGrammar;
  wall: WallGrammar;
  window: WindowGrammar;
  door: DoorGrammar;
  detail: DetailGrammar;
  proportions: StyleProportions;
  lighting: LightingGrammar;
  version: number;
}

export type QualityLevel = "standard" | "detailed" | "showcase";

export const QUALITY_LEVELS: readonly QualityLevel[] = ["standard", "detailed", "showcase"];

export const QUALITY_LABELS: Record<QualityLevel, string> = {
  standard: "Standard",
  detailed: "Detailed",
  showcase: "Showcase",
};

export const QUALITY_COPY: Record<QualityLevel, string> = {
  standard: "Core architecture, doors, windows, roofs and essential lighting.",
  detailed:
    "Adds facade framing, roof variation, entrance paths, planters, balconies and more lighting.",
  showcase:
    "Adds fine trims, extra roof systems, courtyard decoration, richer lighting and landmark detail.",
};
