"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQrCraft } from "@/state/useQrCraft";
import { EncodePanel } from "@/components/controls/EncodePanel";
import { BuildPanel } from "@/components/controls/BuildPanel";
import { CertificationPanel } from "@/components/controls/CertificationPanel";
import { ExportPanel } from "@/components/controls/ExportPanel";
import { QR_STATUS_LABELS, isVerifiedStatus } from "@/lib/qr/status";
import { startDemoGeneration, generateWorld } from "@/lib/client/generation-service";
import { requestExplorePointerLock } from "@/lib/client/explore-lock";

const WorldCanvas = dynamic(() => import("@/components/viewer/WorldCanvas"), {
  ssr: false,
  loading: () => <div className="canvas-placeholder">Preparing the renderer…</div>,
});

type InspectorTab = "build" | "verify" | "export";

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: "build", label: "Build" },
  { id: "verify", label: "Verify" },
  { id: "export", label: "Export" },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="brand-mark">
      <path d="M4 4h12v12H4zM24 4h12v12H24zM4 24h12v12H4z" fill="currentColor" />
      <path d="M24 24h6v6h-6zM32 32h4v4h-4zM24 32h4v4h-4zM32 24h4v4h-4z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function StatusBadge() {
  const certification = useQrCraft((state) => state.certification);
  const certifying = useQrCraft((state) => state.certifying);
  const verified = isVerifiedStatus(certification.status);
  const failed = certification.status === "failed";
  return (
    <span
      className={`qr-badge ${verified ? "qr-badge--verified" : failed ? "qr-badge--failed" : "qr-badge--waiting"}`}
      data-testid="qr-status"
      title={certification.message}
    >
      <span className="qr-badge__dot" />
      {verified
        ? "QR VERIFIED"
        : certifying
          ? "Verifying…"
          : QR_STATUS_LABELS[certification.status]}
    </span>
  );
}

function StageOverlay() {
  const generating = useQrCraft((state) => state.generating);
  const stage = useQrCraft((state) => state.stage);
  const error = useQrCraft((state) => state.error);

  if (!generating && !error) return null;

  if (error && !generating) {
    return (
      <div className="stage-overlay">
        <div className="stage-card stage-card--error" role="alert">
          <p className="eyebrow">Generation failed</p>
          <h2>The site could not be prepared</h2>
          <p>{error}</p>
          <button type="button" className="button button--primary" onClick={() => generateWorld()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-overlay stage-overlay--soft">
      <div className="stage-card">
        <p className="eyebrow">Cartographer at work</p>
        <h2>Generating the kingdom</h2>
        <p className="stage-stage" data-testid="generation-stage">
          {stage}
        </p>
        <div className="indeterminate" aria-hidden="true">
          <span />
        </div>
        <p className="stage-note">
          Real QR encoding, real geometry, and a dependency-ordered construction plan. This can take a
          few seconds.
        </p>
      </div>
    </div>
  );
}

function StageFrame() {
  const viewMode = useQrCraft((state) => state.viewMode);
  const setViewMode = useQrCraft((state) => state.setViewMode);
  const setCameraPreset = useQrCraft((state) => state.setCameraPreset);
  const cameraPreset = useQrCraft((state) => state.cameraPreset);
  const exploreLocked = useQrCraft((state) => state.exploreLocked);
  const result = useQrCraft((state) => state.result);
  const builder = useQrCraft((state) => state.builder);

  const progress = Math.round(builder.progress * 1000) / 10;

  return (
    <section className="stage" aria-label="3D kingdom viewport">
      <div className="stage__canvas">
        <WorldCanvas />
        <div className="stage__vignette" aria-hidden="true" />

        <div className="stage__topbar">
          <div className="view-tabs" role="tablist" aria-label="View mode">
            {(
              [
                ["showcase", "Showcase"],
                ["top", "Top-down"],
                ["explore", "Explore"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={viewMode === mode}
                className={`view-tab ${viewMode === mode ? "is-active" : ""}`}
                onClick={() => setViewMode(mode)}
                data-testid={`view-${mode}`}
              >
                {label}
              </button>
            ))}
          </div>

          {viewMode === "showcase" && (
            <div className="camera-presets" aria-label="Camera presets">
              {(
                [
                  ["iso", "Iso"],
                  ["front", "South"],
                  ["side", "East"],
                ] as const
              ).map(([preset, label]) => (
                <button
                  key={preset}
                  type="button"
                  className={`chip ${cameraPreset === preset ? "is-active" : ""}`}
                  onClick={() => setCameraPreset(preset)}
                >
                  {label}
                </button>
              ))}
              <span className="chip chip--hint">drag to orbit · scroll to zoom</span>
            </div>
          )}
        </div>

        {result && viewMode !== "explore" && (
          <div className="stage__caption">
            <span className="stage__caption-title">
              {result.brief.siteLabel} · {result.brief.styleLabel}
            </span>
            <span className="stage__caption-meta">
              seed {result.brief.seed} · {result.layout.worldSize}² world ·{" "}
              {result.brief.qualityLabel} quality · {result.qr.moduleCount} modules at{" "}
              {result.layout.cellSize} blocks each
            </span>
          </div>
        )}

        {result &&
          viewMode !== "explore" &&
          builder.status !== "complete" &&
          builder.status !== "cancelled" && (
            <div className="stage__build" data-testid="stage-progress">
              <div className="stage__build-head">
                <span>{builder.taskLabel}</span>
                <span className="numeric">{progress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar progress-bar--thin">
                <span style={{ width: `${Math.max(progress, 0.6)}%` }} />
              </div>
            </div>
          )}

        {viewMode === "explore" && (
          <>
            {exploreLocked ? (
              <div className="crosshair" aria-hidden="true" />
            ) : (
              <div className="explore-prompt" data-testid="explore-prompt">
                <p className="eyebrow">First-person mode</p>
                <h2>Walk the kingdom</h2>
                <p>
                  Pointer lock captures the mouse for looking around. Movement continues in the same
                  voxel world you see being built.
                </p>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => requestExplorePointerLock()}
                  data-testid="explore-lock"
                >
                  Enter explore mode
                </button>
                <span className="explore-prompt__hint">
                  WASD move · Space jump · Shift sprint · R respawn · Esc release
                </span>
              </div>
            )}
            <div className="explore-hud">
              <span>{exploreLocked ? "Esc to release the mouse" : "Click to look around"}</span>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => setViewMode("showcase")}
              >
                Leave explore
              </button>
            </div>
          </>
        )}

        {viewMode === "top" && (
          <div className="topview-note">
            <strong>Reading the city plan</strong>
            <span>
              Every city plot takes its top surface from one QR module. This view is for inspection;
              certification decodes an offscreen render of the same scene.
            </span>
          </div>
        )}

        <StageOverlay />
      </div>
    </section>
  );
}

export function QrCraftApp() {
  const [tab, setTab] = useState<InspectorTab>("build");
  const result = useQrCraft((state) => state.result);
  const builder = useQrCraft((state) => state.builder);
  const setViewMode = useQrCraft((state) => state.setViewMode);

  useEffect(() => {
    startDemoGeneration();
  }, []);

  const payloadLine = useMemo(() => {
    if (!result) return "No encoded payload yet";
    const payload = result.qr.payload;
    return payload.length > 64 ? `${payload.slice(0, 61)}…` : payload;
  }, [result]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <div className="brand__text">
            <span className="brand__name">QRCraft</span>
            <span className="brand__tag">A scannable medieval kingdom</span>
          </div>
        </div>

        <div className="topbar__meta">
          <div className="topbar__payload" title={result?.qr.payload ?? undefined}>
            <span className="topbar__payload-label">Payload</span>
            <code>{payloadLine}</code>
          </div>
          <StatusBadge />
        </div>

        <div className="topbar__actions">
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => setViewMode("explore")}
            data-testid="header-explore"
          >
            Walk the site
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="panel panel--left" aria-label="Encode and generate">
          <div className="panel__head">
            <p className="eyebrow">01 · Cartography</p>
            <h1>Encode a kingdom</h1>
            <p>
              Type a URL or message, or upload an existing QR image. QRCraft rebuilds it as a real
              place, then proves the top projection still scans.
            </p>
          </div>
          <EncodePanel />
        </aside>

        <StageFrame />

        <aside className="panel panel--right" aria-label="Build, verify and export">
          <div className="inspector-tabs" role="tablist" aria-label="Inspector">
            {INSPECTOR_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`inspector-tab ${tab === entry.id ? "is-active" : ""}`}
                onClick={() => setTab(entry.id)}
                data-testid={`tab-${entry.id}`}
              >
                {entry.label}
                {entry.id === "verify" && (
                  <span
                    className={`tab-dot ${
                      result && builder.status === "complete" ? "tab-dot--live" : ""
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="panel__scroll">
            {tab === "build" && <BuildPanel />}
            {tab === "verify" && <CertificationPanel />}
            {tab === "export" && <ExportPanel />}
          </div>
        </aside>
      </div>

      <footer className="footer">
        <span>
          Deterministic world generation · local QR encoding and decoding · no AI services at runtime
        </span>
        <span className="footer__links">
          Exports: GLB · PLY · STL · Sponge schematic
        </span>
      </footer>
    </main>
  );
}
