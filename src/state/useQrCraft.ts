"use client";

import { create } from "zustand";
import type { Complexity, SiteSize } from "@/lib/world/site";
import type { StyleId } from "@/lib/blocks/registry";
import type { QualityLevel } from "@/lib/blocks/style-types";
import type { SiteId } from "@/lib/sites/types";
import type { GeneratedWorldTransfer } from "@/lib/worker/protocol";
import type { ConstructionEngine } from "@/lib/construction/engine";
import type { BuilderState } from "@/lib/construction/engine";
import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import { EMPTY_CERTIFICATION, type CertificationState } from "@/lib/qr/status";

export type ViewMode = "showcase" | "top" | "explore";
export type CameraPreset = "iso" | "front" | "side" | "reset";

const IDLE_BUILDER: BuilderState = {
  status: "idle",
  taskIndex: 0,
  taskCount: 0,
  taskLabel: "Waiting for a site plan",
  group: "",
  phase: "",
  appliedBlocks: 0,
  totalBlocks: 0,
  progress: 0,
  speed: 4,
};

export interface QrCraftState {
  payload: string;
  seed: number;
  size: SiteSize;
  site: SiteId;
  style: StyleId;
  quality: QualityLevel;
  complexity: Complexity;
  generating: boolean;
  stage: string;
  error: string | null;
  uploadNote: string | null;
  dirty: boolean;
  result: GeneratedWorldTransfer | null;
  liveWorld: VoxelWorld | null;
  engine: ConstructionEngine | null;
  builder: BuilderState;
  viewMode: ViewMode;
  cameraPreset: CameraPreset;
  cameraPresetNonce: number;
  exploreLocked: boolean;
  certification: CertificationState;
  certificationRequestId: number;
  certifying: boolean;

  setPayload: (value: string) => void;
  setSeed: (value: number) => void;
  setSize: (value: SiteSize) => void;
  setSite: (value: SiteId) => void;
  setStyle: (value: StyleId) => void;
  setQuality: (value: QualityLevel) => void;
  setComplexity: (value: Complexity) => void;
  setUploadNote: (value: string | null) => void;
  beginGeneration: () => void;
  setStage: (stage: string) => void;
  failGeneration: (message: string) => void;
  setGenerated: (result: GeneratedWorldTransfer, world: VoxelWorld, engine: ConstructionEngine) => void;
  setBuilder: (builder: BuilderState) => void;
  setEngine: (engine: ConstructionEngine | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setExploreLocked: (locked: boolean) => void;
  setCertification: (certification: CertificationState) => void;
  setCertifying: (certifying: boolean) => void;
  requestCertification: () => void;
  reset: () => void;
}

export const useQrCraft = create<QrCraftState>((set) => ({
  payload: "https://example.com/qrcraft",
  seed: 1337,
  size: 192,
  site: "kingdom",
  style: "gothic",
  quality: "detailed",
  complexity: "balanced",
  generating: false,
  stage: "Ready",
  error: null,
  uploadNote: null,
  dirty: false,
  result: null,
  liveWorld: null,
  engine: null,
  builder: IDLE_BUILDER,
  viewMode: "showcase",
  cameraPreset: "iso",
  cameraPresetNonce: 0,
  exploreLocked: false,
  certification: EMPTY_CERTIFICATION,
  certificationRequestId: 0,
  certifying: false,

  setPayload: (payload) =>
    set((state) =>
      state.payload === payload
        ? state
        : {
            payload,
            error: null,
            uploadNote: null,
            dirty: state.result !== null,
            certification: state.result !== null ? EMPTY_CERTIFICATION : state.certification,
          },
    ),
  setSeed: (seed) =>
    set((state) => {
      const value = Number.isFinite(seed) ? Math.trunc(seed) : 1337;
      if (state.seed === value) return state;
      return {
        seed: value,
        dirty: state.result !== null,
        certification: state.result !== null ? EMPTY_CERTIFICATION : state.certification,
      };
    }),
  setSize: (size) =>
    set((state) =>
      state.size === size
        ? state
        : {
            size,
            dirty: state.result !== null,
            certification: state.result !== null ? EMPTY_CERTIFICATION : state.certification,
          },
    ),
  setSite: (site) =>
    set((state) =>
      state.site === site
        ? state
        : {
            site,
            dirty: state.result !== null,
            certification: state.result !== null ? EMPTY_CERTIFICATION : state.certification,
          },
    ),
  setStyle: (style) =>
    set((state) =>
      state.style === style
        ? state
        : {
            style,
            dirty: state.result !== null,
            certification: state.result !== null ? EMPTY_CERTIFICATION : state.certification,
          },
    ),
  setQuality: (quality) =>
    set((state) =>
      state.quality === quality
        ? state
        : {
            quality,
            dirty: state.result !== null,
            certification: state.result !== null ? EMPTY_CERTIFICATION : state.certification,
          },
    ),
  setComplexity: (complexity) =>
    set((state) =>
      state.complexity === complexity
        ? state
        : {
            complexity,
            dirty: state.result !== null,
            certification: state.result !== null ? EMPTY_CERTIFICATION : state.certification,
          },
    ),
  setUploadNote: (uploadNote) => set({ uploadNote }),
  beginGeneration: () =>
    set({
      generating: true,
      error: null,
      dirty: false,
      stage: "Encoding the QR code",
      certification: EMPTY_CERTIFICATION,
      certifying: false,
      builder: IDLE_BUILDER,
      engine: null,
      result: null,
      liveWorld: null,
    }),
  setStage: (stage) => set({ stage }),
  failGeneration: (error) => set({ generating: false, error, stage: "Generation failed" }),
  setGenerated: (result, liveWorld, engine) =>
    set({
      generating: false,
      dirty: false,
      stage: "Builder entering the site",
      result,
      liveWorld,
      engine,
      builder: engine.state,
      viewMode: "showcase",
      cameraPreset: "iso",
      cameraPresetNonce: 0,
    }),
  setBuilder: (builder) => set({ builder }),
  setEngine: (engine) => set({ engine }),
  setViewMode: (viewMode) =>
    set(viewMode === "explore" ? { viewMode } : { viewMode, exploreLocked: false }),
  setCameraPreset: (cameraPreset) =>
    set((state) => ({ cameraPreset, cameraPresetNonce: state.cameraPresetNonce + 1, viewMode: "showcase" })),
  setExploreLocked: (exploreLocked) => set({ exploreLocked }),
  setCertification: (certification) => set({ certification }),
  setCertifying: (certifying) => set({ certifying }),
  requestCertification: () => set((state) => ({ certificationRequestId: state.certificationRequestId + 1 })),
  reset: () =>
    set({
      generating: false,
      dirty: false,
      stage: "Ready",
      error: null,
      result: null,
      liveWorld: null,
      engine: null,
      builder: IDLE_BUILDER,
      certification: EMPTY_CERTIFICATION,
    }),
}));
