import {
  GENERATION_VERSION,
  createSiteLayout,
  type Complexity,
  type SiteSize,
  type WorldConfig,
} from "@/lib/world/site";
import type { StyleId } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";
import { siteFor, siteLandscapeBand } from "@/lib/sites/registry";
import type { QRMatrix } from "@/lib/qr/matrix";
import { projectWorld, type ProjectionReport } from "@/lib/qr/projector";
import { certifyTopView, type DecodeResult } from "@/lib/qr/software-render";
import { VoxelWorld } from "@/lib/world/VoxelWorld";
import { PlacementRecorder } from "@/lib/world/recorder";
import { createRng } from "@/lib/world/rng";
import { generateTerrain } from "@/lib/world/terrain";
import { buildCity, type CityResult } from "@/lib/world/city";
import { createWorldBrief, scoreScene } from "@/lib/world/director";
import { compileBuildPlan } from "@/lib/construction/plan";
import type { BuildPlan, WorldBrief, WorldStats } from "@/lib/world/types";

export interface GenerationOptions {
  qr: QRMatrix;
  seed: number;
  size: SiteSize;
  site?: SiteId;
  style: StyleId;
  quality?: QualityLevel;
  complexity: Complexity;
  onStage?: (stage: string) => void;
}

export interface GenerationResult {
  qr: QRMatrix;
  layout: ReturnType<typeof createSiteLayout>;
  baseWorld: VoxelWorld;
  finalWorld: VoxelWorld;
  city: CityResult;
  brief: WorldBrief;
  plan: BuildPlan;
  stats: WorldStats;
  projection: ProjectionReport;
  softwareDecode: DecodeResult;
  requestedSize: SiteSize;
  config: WorldConfig & { generationVersion: number };
}

export function collectStats(
  world: VoxelWorld,
  city: CityResult,
  projection: ProjectionReport,
): WorldStats {
  let tallestY = 0;
  for (let z = 0; z < world.sizeZ; z++) {
    for (let x = 0; x < world.sizeX; x++) {
      const top = world.topBlock(x, z);
      if (top && top.y > tallestY) tallestY = top.y;
    }
  }
  const totalBlocks = world.countBlocks();
  const visibleBlocks = world.countVisibleBlocks();
  return {
    totalBlocks,
    visibleBlocks,
    structures: city.structures,
    buildings: city.buildings,
    towers: city.towers,
    tallestY,
    cityGroundBlocks: city.buildings,
    qrCoverage: projection.coverage,
  };
}

export function generateWorld(options: GenerationOptions): GenerationResult {
  const { qr, seed, style, complexity, onStage } = options;
  const siteId = options.site ?? "kingdom";
  const quality = options.quality ?? "detailed";
  const site = siteFor(siteId);
  const layout = createSiteLayout(qr, options.size, site.minimumSize, siteLandscapeBand(siteId));
  onStage?.("Shaping the landscape");
  const terrain = generateTerrain(layout, seed, complexity, site);
  const baseWorld = terrain.world;
  const finalWorld = baseWorld.clone();
  const recorder = new PlacementRecorder(finalWorld);
  onStage?.("Composing the Medieval Kingdom");
  const city = buildCity({
    rec: recorder,
    layout,
    style,
    site: siteId,
    quality,
    complexity,
    rng: createRng((seed ^ 0x51ed270b) >>> 0),
  });
  const brief = createWorldBrief(
    layout,
    { seed, size: layout.worldSize, site: siteId, style, quality, complexity },
    city,
    {
      fieldCount: terrain.fieldRects.length,
      hasHamlet: terrain.hasHamlet,
      siteFeatures: terrain.features,
    },
  );
  onStage?.("Checking the QR projection");
  const projection = projectWorld(finalWorld, layout);
  onStage?.("Decoding the rendered top view");
  const softwareDecode = certifyTopView(finalWorld, layout, qr.payload);
  onStage?.("Compiling the construction plan");
  const stats = collectStats(finalWorld, city, projection);
  const score = scoreScene(layout, city, stats, projection);
  const plan = compileBuildPlan(recorder.placements, brief, score);
  return {
    qr,
    layout,
    baseWorld,
    finalWorld,
    city,
    brief,
    plan,
    stats,
    projection,
    softwareDecode,
    requestedSize: options.size,
    config: {
      payload: qr.payload,
      seed,
      size: layout.worldSize,
      site: siteId,
      style,
      quality,
      complexity,
      generationVersion: GENERATION_VERSION,
    },
  };
}
