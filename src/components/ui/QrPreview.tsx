"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { createQrMatrix } from "@/lib/qr/matrix";
import { chooseWorldSize, SITE_LABELS, type SiteSize } from "@/lib/world/site";

export function QrPreview({
  payload,
  size,
  minimumSize = size,
  landscapeBand = 0,
}: {
  payload: string;
  size: SiteSize;
  minimumSize?: SiteSize;
  landscapeBand?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Rendering failures are stored with the payload they belong to, so a new
  // payload never shows a stale error and the effect needs no state reset.
  const [renderFailure, setRenderFailure] = useState<{ payload: string; message: string } | null>(
    null,
  );

  const matrixState = useMemo(() => {
    try {
      const qr = createQrMatrix(payload, { errorCorrectionLevel: "M", quietZone: 4 });
      const choice = chooseWorldSize(qr, size, minimumSize, landscapeBand);
      return { qr, choice, error: null as string | null };
    } catch (error) {
      return {
        qr: null,
        choice: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [payload, size, minimumSize, landscapeBand]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (matrixState.error || !payload.trim()) {
      const context = canvas.getContext("2d");
      if (context) {
        canvas.width = 240;
        canvas.height = 240;
        context.fillStyle = "#f1ecdf";
        context.fillRect(0, 0, 240, 240);
        context.fillStyle = "#7e837d";
        context.font = "12px monospace";
        context.textAlign = "center";
        context.fillText("Enter a payload", 120, 122);
      }
      return;
    }
    let cancelled = false;
    QRCode.toCanvas(canvas, payload, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 240,
      color: { dark: "#141a18", light: "#f4f0e5" },
    }).catch((error: unknown) => {
      if (!cancelled) {
        setRenderFailure({
          payload,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [matrixState.error, payload]);

  const renderError = renderFailure?.payload === payload ? renderFailure.message : null;

  return (
    <div className="qr-preview">
      <div className="qr-preview__canvas-wrap">
        <canvas ref={canvasRef} width={240} height={240} aria-label="QR code preview" />
      </div>
      <div className="qr-preview__meta">
        {matrixState.qr && matrixState.choice ? (
          <>
            <span>
              v{matrixState.qr.version} · {matrixState.qr.moduleCount} modules
            </span>
            <span>
              {SITE_LABELS[matrixState.choice.size]} · {matrixState.choice.cellSize} blocks/module
            </span>
            {matrixState.choice.upgraded && (
              <span className="qr-preview__upgrade">
                {matrixState.choice.minimumForced
                  ? `This site requires at least ${SITE_LABELS[minimumSize]} (${minimumSize}²); using ${SITE_LABELS[matrixState.choice.size]}.`
                  : matrixState.choice.landscapeForced
                    ? `Raised to ${SITE_LABELS[matrixState.choice.size]} to leave a landscape band for outer landmarks.`
                    : `Auto-upgraded from ${SITE_LABELS[size]} because the payload needs at least 3 blocks per module.`}
              </span>
            )}
          </>
        ) : (
          <span className="qr-preview__error">{matrixState.error ?? "No payload yet."}</span>
        )}
        {renderError && <span className="qr-preview__error">{renderError}</span>}
      </div>
    </div>
  );
}
