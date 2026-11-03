import type { QualityLevel } from "@/lib/blocks/style-types";
import type { StyleId } from "@/lib/blocks/styles";

export type SiteDimension = 128 | 192 | 256 | 320;

/**
 * Canonical site order. The first four are the preserved V1 presets; their IDs,
 * sizes and default generation path must not change.
 */
export const SITE_ID_VALUES = [
  "hamlet",
  "kingdom",
  "grand-kingdom",
  "monumental",
  "alpine-citadel",
  "coastal-fortress",
  "imperial-capital",
  "cathedral-city",
  "riverside-trade-town",
  "highland-monastery",
  "dwarven-mountain-hold",
  "ancient-temple-valley",
  "enchanted-forest",
  "giant-tree-sanctuary",
  "mushroom-vale",
  "crystal-cavern-realm",
  "snowbound-village",
  "volcanic-fortress",
  "pirate-harbor",
  "desert-oasis-city",
  "garden-citadel",
  "steampunk-industrial-port",
  "jungle-temple-ruins",
  "floating-sky-kingdom",
] as const;

export type SiteId = (typeof SITE_ID_VALUES)[number];

export type SiteCategory =
  | "Medieval"
  | "Historical"
  | "Fantasy"
  | "Natural"
  | "Coastal"
  | "Industrial"
  | "Monumental";

export type TerrainProfile =
  | "valley"
  | "alpine"
  | "coastal"
  | "river"
  | "forest"
  | "jungle"
  | "cavern"
  | "sky"
  | "fungal"
  | "volcanic"
  | "desert"
  | "oasis"
  | "garden"
  | "snow"
  | "highland"
  | "mountain"
  | "ruins"
  | "tropical"
  | "industrial"
  | "plateau";

export type VegetationKind =
  | "oak"
  | "spruce"
  | "birch"
  | "jungle"
  | "palm"
  | "mushroom"
  | "crystal"
  | "dead"
  | "none";

export type OuterFeatureKind =
  | "giant-tree"
  | "sky-islands"
  | "pirate-ship"
  | "lighthouse"
  | "harbor"
  | "mountain-gate"
  | "temple-ruins"
  | "monastery"
  | "volcano"
  | "lava-channels"
  | "crystal-cavern"
  | "giant-mushrooms"
  | "oasis"
  | "canals"
  | "smokestacks"
  | "terraces"
  | "ruins"
  | "stone-circle"
  | "waterfall"
  | "windmill"
  | "sky-bridges"
  | "none";

export type FluidKind = "water" | "lava" | "none";

export interface SiteTerrainRules {
  profile: TerrainProfile;
  /** Extra relief in blocks above the base landscape. */
  relief: number;
  waterLevel: number;
  fluid: FluidKind;
  surface: string;
  subsurface: string;
  stone: string;
  beach?: string;
  snowLine?: number;
  vegetation: VegetationKind;
  /** 0-1 target density multiplier for the chosen vegetation. */
  vegetationDensity: number;
  /** Small environmental scatters handled by the site terrain. */
  decorations: readonly string[];
}

export interface SiteLandmarkPlan {
  primary: OuterFeatureKind;
  secondary: readonly OuterFeatureKind[];
  labels: {
    keep: string;
    cathedral: string;
    bastion: string;
  };
  /** Which finder-pattern landmark receives the greatest scale emphasis. */
  cityFocus: "castle" | "cathedral" | "bastion" | "balanced";
  cityFeatures: readonly OuterFeatureKind[];
}

export interface SiteCityRules {
  /** 0.55 leaves breathing room, 1 fills every suitable free plot. */
  density: number;
  towerBias: number;
  market: boolean;
  roadSpacing: number;
  /** Multiplier applied to landmark heights. */
  landmarkScale: number;
  /** Density of QR-safe lamps, trims and façade details. */
  detailing: number;
}

export interface WorldSiteDefinition {
  id: SiteId;
  name: string;
  category: SiteCategory;
  description: string;
  shortDescription: string;
  defaultSize: SiteDimension;
  recommendedSizes: readonly SiteDimension[];
  /** Sites that need room for a dominant landmark never silently shrink it. */
  minimumSize: SiteDimension;
  biomeProfile: string;
  terrainProfile: TerrainProfile;
  worldShape: string;
  primaryLandmarks: readonly string[];
  secondaryLandmarks: readonly string[];
  structureCategories: readonly string[];
  vegetationCategories: readonly string[];
  decorationCategories: readonly string[];
  waterProfile: string;
  terrain: SiteTerrainRules;
  landmarks: SiteLandmarkPlan;
  city: SiteCityRules;
  /** Styles that express this site especially well. */
  excellentStyles: readonly StyleId[];
  goodStyles: readonly StyleId[];
  /** Legacy V1 sites keep the original valley generation path. */
  legacy: boolean;
  version: number;
}

export interface SiteCompatibility {
  level: "excellent" | "good" | "unusual";
  score: number;
  label: string;
}

export interface SiteSelection {
  site: SiteId;
  quality: QualityLevel;
}
