import type {
  SiteCategory,
  SiteCityRules,
  SiteDimension,
  SiteLandmarkPlan,
  SiteTerrainRules,
  TerrainProfile,
  WorldSiteDefinition,
} from "@/lib/sites/types";
import type { StyleId } from "@/lib/blocks/styles";
import type { SiteId } from "@/lib/sites/types";

export const BASE_TERRAIN: SiteTerrainRules = {
  profile: "valley",
  relief: 6,
  waterLevel: 16,
  fluid: "water",
  surface: "minecraft:grass_block",
  subsurface: "minecraft:dirt",
  stone: "minecraft:stone",
  beach: "minecraft:sand",
  snowLine: 999,
  vegetation: "oak",
  vegetationDensity: 1,
  decorations: [],
};

export const terrain = (partial: Partial<SiteTerrainRules> & { profile: TerrainProfile }): SiteTerrainRules => ({
  ...BASE_TERRAIN,
  ...partial,
});

export const city = (partial: Partial<SiteCityRules> = {}): SiteCityRules => ({
  density: 1,
  towerBias: 1,
  market: true,
  roadSpacing: 5,
  landmarkScale: 1,
  detailing: 1,
  ...partial,
});

export const landmarkPlan = (partial: SiteLandmarkPlan): SiteLandmarkPlan => ({ ...partial });

export interface SiteSeed {
  id: SiteId;
  name: string;
  category: SiteCategory;
  description: string;
  shortDescription: string;
  defaultSize: SiteDimension;
  recommendedSizes?: readonly SiteDimension[];
  minimumSize?: SiteDimension;
  biomeProfile: string;
  terrainProfile?: TerrainProfile;
  worldShape: string;
  primaryLandmarks: readonly string[];
  secondaryLandmarks: readonly string[];
  structureCategories?: readonly string[];
  vegetationCategories?: readonly string[];
  decorationCategories?: readonly string[];
  waterProfile: string;
  terrain: SiteTerrainRules;
  landmarks: SiteLandmarkPlan;
  city: SiteCityRules;
  excellentStyles: readonly StyleId[];
  goodStyles?: readonly StyleId[];
  legacy?: boolean;
}

export const defineSite = (seed: SiteSeed): WorldSiteDefinition => ({
  ...seed,
  terrainProfile: seed.terrainProfile ?? seed.terrain.profile,
  recommendedSizes: seed.recommendedSizes ?? [seed.defaultSize],
  minimumSize: seed.minimumSize ?? seed.defaultSize,
  structureCategories: seed.structureCategories ?? [],
  vegetationCategories: seed.vegetationCategories ?? [],
  decorationCategories: seed.decorationCategories ?? [],
  goodStyles: seed.goodStyles ?? [],
  legacy: seed.legacy ?? false,
  version: 2,
});

export const legacyLabels = {
  keep: "High Keep",
  cathedral: "Grand Cathedral",
  bastion: "East Bastion",
} as const;
