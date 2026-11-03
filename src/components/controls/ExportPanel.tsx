"use client";

import { useState } from "react";
import { useQrCraft } from "@/state/useQrCraft";
import {
  EXPORT_FORMATS,
  exportWorld,
  type ExportFormat,
  type ExportOutcome,
} from "@/lib/client/export-service";
import { formatBytes } from "@/lib/client/download";

export function ExportPanel() {
  const result = useQrCraft((state) => state.result);
  const liveWorld = useQrCraft((state) => state.liveWorld);
  const builder = useQrCraft((state) => state.builder);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!result) {
    return (
      <div className="empty-panel">
        <span className="empty-panel__mark">⇩</span>
        <h3>No world to export</h3>
        <p>Generate and finish a kingdom. Exports read the completed voxel volume.</p>
      </div>
    );
  }

  const complete = builder.status === "complete" && Boolean(liveWorld);

  const run = async (format: ExportFormat) => {
    if (!liveWorld || !complete) return;
    setBusy(format);
    setError(null);
    setOutcome(null);
    try {
      const exported = await exportWorld(format, {
        world: liveWorld,
        seed: result.brief.seed,
        payload: result.qr.payload,
        summary: result.brief.summary,
        siteLabel: result.brief.siteLabel,
        styleLabel: result.brief.styleLabel,
        qualityLabel: result.brief.qualityLabel,
        moduleCount: result.qr.moduleCount,
        cellSize: result.layout.cellSize,
        buildings: result.stats.buildings,
        structures: result.stats.structures,
        generatedAt: new Date().toISOString(),
      });
      setOutcome(exported);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="export-panel">
      {!complete && (
        <div className="callout">
          <strong>Exports unlock when construction completes.</strong>
          <span>
            The world is being built in shared voxel state. Downloading a partial site would produce
            an incomplete QR projection, so the buttons stay locked.
          </span>
        </div>
      )}

      <div className="export-list">
        {EXPORT_FORMATS.map((format) => (
          <article key={format.id} className="export-card">
            <div className="export-card__head">
              <div>
                <h3>{format.label}</h3>
                <span className="export-card__extension">.{format.extension}</span>
              </div>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => void run(format.id)}
                disabled={!complete || busy !== null}
                data-testid={`export-${format.id}`}
              >
                {busy === format.id ? "Writing…" : "Download"}
              </button>
            </div>
            <p>{format.description}</p>
            {format.id === "html" && (
              <span className="export-card__estimate">
                Estimated {formatBytes(result.stats.visibleBlocks * 8 + 140_000)}. The viewer
                embeds the exposed shell, not interiors; the Sponge schematic remains lossless.
              </span>
            )}
            <span className="export-card__includes">{format.includes}</span>
          </article>
        ))}
      </div>

      {outcome && (
        <div className="callout callout--success" data-testid="export-result">
          <strong>Download started: {outcome.filename}</strong>
          <span>
            {formatBytes(outcome.bytes)} written in {outcome.durationMs} ms from the live voxel
            world. The browser save dialog is managed by your browser.
          </span>
        </div>
      )}
      {error && (
        <div className="callout callout--danger">
          <strong>Export failed</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="panel-section panel-section--flush">
        <div className="cert-facts">
          <div>
            <span className="field__label">Volume</span>
            <span>
              {result.layout.worldSize} × {result.layout.worldHeight} × {result.layout.worldSize}{" "}
              blocks
            </span>
          </div>
          <div>
            <span className="field__label">Axis convention</span>
            <span>X east · Y up · Z south, centred on export</span>
          </div>
          <div>
            <span className="field__label">Format support</span>
            <span>Only formats with a tested writer are listed here.</span>
          </div>
        </div>
      </section>

      <p className="panel-footnote">
        Sponge schematic is written as gzipped Sponge Schematic v3 with DataVersion 4189. PLY and GLB
        carry vertex colours; STL is geometry only. Water is included in the schematic volume and
        excluded from the surface meshes. The interactive HTML export embeds only exposed voxel
        surfaces so it stays lightweight; it is a viewer, not a full-volume world save.
      </p>
    </div>
  );
}
