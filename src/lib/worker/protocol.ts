import type { QRMatrix } from "@/lib/qr/matrix";
import type { ProjectionReport } from "@/lib/qr/projector";
import type { DecodeResult } from "@/lib/qr/software-render";
import type { SiteLayout, SiteSize } from "@/lib/world/site";
import type { Complexity } from "@/lib/world/site";
import type { CityResult } from "@/lib/world/city";
import type { BuildPlan, WorldBrief, WorldStats } from "@/lib/world/types";
import type { RenderPayload } from "@/lib/world/render-payload";
import type { WorldSnapshot } from "@/lib/world/VoxelWorld";
import type { StyleId } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";

export interface GenerateRequest {
  type: "generate";
  requestId: number;
  qr: QRMatrix;
  seed: number;
  size: SiteSize;
  site: SiteId;
  style: StyleId;
  quality: QualityLevel;
  complexity: Complexity;
}

export interface StageMessage {
  type: "stage";
  requestId: number;
  stage: string;
}

export interface GeneratedWorldTransfer {
  qr: QRMatrix;
  layout: SiteLayout;
  baseSnapshot: WorldSnapshot;
  /** Palette of the completed world; `render.paletteIndices` indexes this. */
  renderPalette: string[];
  render: RenderPayload;
  plan: BuildPlan;
  stats: WorldStats;
  brief: WorldBrief;
  projection: ProjectionReport;
  softwareDecode: DecodeResult;
  city: CityResult;
  requestedSize: SiteSize;
  generationMs: number;
}

export interface DoneMessage {
  type: "done";
  requestId: number;
  result: GeneratedWorldTransfer;
}

export interface ErrorMessage {
  type: "error";
  requestId: number;
  message: string;
}

export type WorkerResponse = StageMessage | DoneMessage | ErrorMessage;
