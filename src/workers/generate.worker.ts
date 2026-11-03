/// <reference lib="webworker" />
import { generateWorld } from "@/lib/world/generate";
import { buildRenderPayload } from "@/lib/world/render-payload";
import type { GenerateRequest, GeneratedWorldTransfer, WorkerResponse } from "@/lib/worker/protocol";

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerResponse, transfer: Transferable[] = []): void {
  scope.postMessage(message, transfer);
}

scope.addEventListener("message", (event: MessageEvent<GenerateRequest>) => {
  const request = event.data;
  if (!request || request.type !== "generate") return;
  const started = performance.now();
  try {
    const generated = generateWorld({
      qr: request.qr,
      seed: request.seed,
      size: request.size,
      site: request.site,
      style: request.style,
      quality: request.quality,
      complexity: request.complexity,
      onStage: (stage) => post({ type: "stage", requestId: request.requestId, stage }),
    });

    post({ type: "stage", requestId: request.requestId, stage: "Preparing the construction site" });
    const render = buildRenderPayload(generated.baseWorld, generated.finalWorld, generated.plan);
    const baseSnapshot = generated.baseWorld.snapshot();

    const transfer: GeneratedWorldTransfer = {
      qr: request.qr,
      layout: generated.layout,
      baseSnapshot,
      renderPalette: [...generated.finalWorld.palette],
      render,
      plan: generated.plan,
      stats: generated.stats,
      brief: generated.brief,
      projection: generated.projection,
      softwareDecode: generated.softwareDecode,
      city: generated.city,
      requestedSize: generated.requestedSize,
      generationMs: Math.round(performance.now() - started),
    };
    post(
      { type: "done", requestId: request.requestId, result: transfer },
      [
        baseSnapshot.blocks.buffer,
        render.positions.buffer,
        render.paletteIndices.buffer,
        render.orders.buffer,
      ],
    );
  } catch (error) {
    post({
      type: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
