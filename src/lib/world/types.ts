import type { Complexity, SiteLayout, SiteSize } from "@/lib/world/site";
import type { QRMatrix } from "@/lib/qr/matrix";
import type { StyleId } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";

export const BUILD_PHASES = ["ground", "foundation", "walls", "roofs", "details"] as const;
export type BuildPhase = (typeof BUILD_PHASES)[number];

export const PHASE_LABELS: Record<BuildPhase, string> = {
  ground: "Laying the ground",
  foundation: "Setting foundations",
  walls: "Raising walls",
  roofs: "Raising roofs",
  details: "Adding the finishing touches",
};

export interface Placement {
  x: number;
  y: number;
  z: number;
  block: string;
  phase: BuildPhase;
  group: string;
}

export interface BuildTask {
  id: string;
  label: string;
  group: string;
  phase: BuildPhase;
  anchor: { x: number; y: number; z: number };
  blocks: Placement[];
  dependsOn: string[];
}

export interface WorldBrief {
  theme: "medieval";
  themeLabel: string;
  site: SiteId;
  siteLabel: string;
  siteDescription: string;
  style: StyleId;
  styleLabel: string;
  quality: QualityLevel;
  qualityLabel: string;
  size: SiteSize;
  sizeLabel: string;
  complexity: Complexity;
  seed: number;
  qrVersion: number;
  moduleCount: number;
  cellSize: number;
  terrain: string;
  primaryLandmark: string;
  secondaryLandmarks: string[];
  districts: string[];
  infrastructure: string[];
  summary: string;
}

export interface SceneScore {
  total: number;
  landmarkProminence: number;
  verticalHierarchy: number;
  materialCoherence: number;
  densityBalance: number;
  qrCoverage: number;
  notes: Record<string, string>;
}

export interface BuildPlan {
  tasks: BuildTask[];
  totalBlocks: number;
  groups: string[];
  brief: WorldBrief;
  score: SceneScore;
}

export interface WorldStats {
  totalBlocks: number;
  visibleBlocks: number;
  structures: number;
  buildings: number;
  towers: number;
  tallestY: number;
  cityGroundBlocks: number;
  qrCoverage: number;
}

export interface GenerationResult {
  qr: QRMatrix;
  layout: SiteLayout;
  baseWorld: import("@/lib/world/VoxelWorld").VoxelWorld;
  finalWorld: import("@/lib/world/VoxelWorld").VoxelWorld;
  plan: BuildPlan;
  stats: WorldStats;
  config: {
    seed: number;
    size: SiteSize;
    site: SiteId;
    style: StyleId;
    quality: QualityLevel;
    complexity: Complexity;
    payload: string;
    generationVersion: number;
  };
}
