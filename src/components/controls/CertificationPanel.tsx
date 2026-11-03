"use client";

import { useQrCraft } from "@/state/useQrCraft";
import { StatusLadder } from "@/components/ui/StatusLadder";
import { isVerifiedStatus, QR_STATUS_LABELS } from "@/lib/qr/status";

function formatCheckedAt(value: string | null): string {
  if (!value) return "not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function CertificationPanel() {
  const result = useQrCraft((state) => state.result);
  const certification = useQrCraft((state) => state.certification);
  const certifying = useQrCraft((state) => state.certifying);
  const builder = useQrCraft((state) => state.builder);
  const requestCertification = useQrCraft((state) => state.requestCertification);

  const complete = builder.status === "complete";
  const verified = isVerifiedStatus(certification.status);

  if (!result) {
    return (
      <div className="empty-panel">
        <span className="empty-panel__mark">✓</span>
        <h3>Nothing to certify</h3>
        <p>Generate a kingdom, then let the builder finish. Verification runs against the real top view.</p>
      </div>
    );
  }

  return (
    <div className="cert-panel">
      <section className={`cert-hero ${verified ? "cert-hero--verified" : ""}`}>
        <span className="cert-hero__seal" aria-hidden="true">
          {verified ? "✓" : certification.status === "failed" ? "×" : "?"}
        </span>
        <div>
          <p className="eyebrow">Optical certification</p>
          <h3>{verified ? "QR VERIFIED" : QR_STATUS_LABELS[certification.status]}</h3>
          <p className="cert-hero__message">{certification.message}</p>
        </div>
      </section>

      <StatusLadder status={certification.status} certifying={certifying} />

      {certification.captureDataUrl && (
        <figure className="capture-preview">
          {/* The capture is generated locally as a data URL; it never leaves the browser. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={certification.captureDataUrl}
            alt="Top-down capture of the live 3D scene used for QR verification"
            width={640}
            height={640}
          />
          <figcaption>
            Actual offscreen capture · {certification.renderedWidth} × {certification.renderedHeight}
            , decoded after scan-scale resampling
          </figcaption>
        </figure>
      )}

      <section className="panel-section panel-section--flush">
        <dl className="verify-grid">
          <div>
            <dt>Payload match</dt>
            <dd className={certification.payloadMatched ? "text-pass" : "text-idle"}>
              {certification.payloadMatched ? "Exact" : "Not confirmed"}
            </dd>
          </div>
          <div>
            <dt>Capture</dt>
            <dd>
              {certification.renderedWidth && certification.renderedHeight
                ? `${certification.renderedWidth} × ${certification.renderedHeight}`
                : "not captured"}
            </dd>
          </div>
          <div>
            <dt>Robustness</dt>
            <dd>
              {certification.robustnessTotal > 0
                ? `${certification.robustnessPassed} / ${certification.robustnessTotal} variants`
                : "not run"}
            </dd>
          </div>
          <div>
            <dt>Last checked</dt>
            <dd>{formatCheckedAt(certification.checkedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="panel-section panel-section--flush">
        <div className="cert-facts">
          <div>
            <span className="field__label">Requested payload</span>
            <code className="payload-code">{result.qr.payload}</code>
          </div>
          <div>
            <span className="field__label">Matrix</span>
            <span>
              Version {result.qr.version} · {result.qr.moduleCount} modules ·{" "}
              {result.qr.errorCorrectionLevel} correction
            </span>
          </div>
          <div>
            <span className="field__label">Projection</span>
            <span>
              {result.projection.conflicts === 0
                ? `All ${result.projection.columns.toLocaleString()} columns match`
                : `${result.projection.conflicts} mismatched columns`}
            </span>
          </div>
        </div>
      </section>

      <button
        type="button"
        className="button button--primary button--wide"
        onClick={() => requestCertification()}
        disabled={!complete || certifying}
        data-testid="certify-button"
      >
        {certifying
          ? "Rendering and decoding…"
          : complete
            ? "Verify the live top view"
            : "Wait for construction to finish"}
      </button>

      <p className="panel-footnote">
        Verification renders the live Three.js scene from an orthographic top camera into an
        offscreen framebuffer, reads the pixels back, and decodes them with ZXing. The badge is never
        set from the QR matrix alone. Only a rendered image that decodes to this exact payload can
        reach <strong>QR VERIFIED</strong>.
      </p>
    </div>
  );
}
