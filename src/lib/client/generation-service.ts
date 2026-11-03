"use client";

import { createQrMatrix } from "@/lib/qr/matrix";
import type { WorkerResponse } from "@/lib/worker/protocol";
import type { GeneratedWorldTransfer } from "@/lib/worker/protocol";
import { VoxelWorld } from "@/lib/world/VoxelWorld";
import { ConstructionEngine } from "@/lib/construction/engine";
import { useQrCraft } from "@/state/useQrCraft";
import {
  EMPTY_CERTIFICATION,
  type CertificationState,
} from "@/lib/qr/status";

let worker: Worker | null = null;
let requestCounter = 0;
let activeRequest = 0;
let engineLoop: number | null = null;
let demoStarted = false;
let activeEngine: ConstructionEngine | null = null;

function ensureWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (worker) return worker;
  worker = new Worker(new URL("../../workers/generate.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === "stage") {
      if (message.requestId === activeRequest) {
        useQrCraft.getState().setStage(message.stage);
      }
      return;
    }
    if (message.requestId !== activeRequest) return;
    if (message.type === "error") {
      useQrCraft.getState().failGeneration(message.message);
      return;
    }
    if (message.type === "done") {
      acceptResult(message.result);
    }
  });
  worker.addEventListener("error", (event) => {
    if (activeRequest > 0) {
      useQrCraft.getState().failGeneration(
        event.message || "The generation worker stopped unexpectedly.",
      );
    }
  });
  return worker;
}

function startEngineLoop(engine: ConstructionEngine): void {
  if (engineLoop !== null) cancelAnimationFrame(engineLoop);
  let last = performance.now();
  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    engine.update(dt);
    engineLoop = requestAnimationFrame(frame);
  };
  engineLoop = requestAnimationFrame(frame);
}

function acceptResult(result: GeneratedWorldTransfer): void {
  const world = VoxelWorld.fromOwnedSnapshot(result.baseSnapshot);
  const startX = result.layout.centerX + 0.5;
  const startZ = result.layout.cityRect.z2 + 4.5;
  const startTop = world.topBlock(Math.round(startX), Math.round(startZ));
  const engine = new ConstructionEngine(world, result.plan, {
    start: { x: startX, y: (startTop?.y ?? result.layout.cityGroundY) + 1.01, z: startZ },
    onChange: (state) => {
      useQrCraft.getState().setBuilder(state);
      if (state.status === "complete") {
        useQrCraft.getState().requestCertification();
      }
    },
  });
  if (activeEngine) activeEngine.cancel();
  activeEngine = engine;
  useQrCraft.getState().setGenerated(result, world, engine);
  useQrCraft.getState().setCertification(initialCertification(result));
  engine.start();
  startEngineLoop(engine);
}

function initialCertification(result: GeneratedWorldTransfer): CertificationState {
  const matrix = result.projection.matrixMatched;
  const software = result.softwareDecode.payloadMatched;
  if (matrix && software) {
    return {
      ...EMPTY_CERTIFICATION,
      status: "matrix-matched",
      message:
        "Every projected column matches its QR module and the independent top-projection raster decoded. Waiting for the live camera certification after construction.",
      payloadMatched: true,
      checkedAt: new Date().toISOString(),
    };
  }
  const reasons: string[] = [];
  if (!matrix) {
    reasons.push(`${result.projection.conflicts} projected columns do not match the target matrix`);
  }
  if (!software) {
    reasons.push(
      `the top-projection raster did not decode${result.softwareDecode.error ? ` (${result.softwareDecode.error})` : ""}`,
    );
  }
  return {
    ...EMPTY_CERTIFICATION,
    status: "failed",
    message: `Certification failed: ${reasons.join("; ")}.`,
    payloadMatched: false,
    checkedAt: new Date().toISOString(),
  };
}

export function generateWorld(): void {
  const state = useQrCraft.getState();
  if (state.generating) return;
  const target = ensureWorker();
  if (!target) return;
  state.beginGeneration();
  let qr;
  try {
    qr = createQrMatrix(state.payload, { errorCorrectionLevel: "M", quietZone: 4 });
  } catch (error) {
    state.failGeneration(error instanceof Error ? error.message : String(error));
    return;
  }
  requestCounter += 1;
  activeRequest = requestCounter;
  target.postMessage({
    type: "generate",
    requestId: activeRequest,
    qr,
    seed: state.seed,
    size: state.size,
    site: state.site,
    style: state.style,
    quality: state.quality,
    complexity: state.complexity,
  });
}

export function startDemoGeneration(): void {
  if (typeof window === "undefined") return;
  if (demoStarted) return;
  demoStarted = true;
  generateWorld();
}
