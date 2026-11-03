"use client";

import type { QrCertificationStatus } from "@/lib/qr/status";
import { QR_STATUS_LABELS } from "@/lib/qr/status";

const LADDER: QrCertificationStatus[] = [
  "not-tested",
  "matrix-matched",
  "rendered-decoded",
  "robustness-passed",
  "failed",
];

function reached(status: QrCertificationStatus, step: QrCertificationStatus): boolean {
  if (status === "failed") return false;
  const order: QrCertificationStatus[] = [
    "not-tested",
    "matrix-matched",
    "rendered-decoded",
    "robustness-passed",
  ];
  return order.indexOf(status) >= order.indexOf(step);
}

export function StatusLadder({
  status,
  certifying,
}: {
  status: QrCertificationStatus;
  certifying: boolean;
}) {
  return (
    <ol className="status-ladder" aria-label="QR certification status">
      {LADDER.map((step) => {
        const active = status === step;
        // "Not tested" is a starting state, not a passed stage. The remaining
        // stages only receive a check once they have actually run.
        const passed =
          step !== "failed" &&
          step !== "not-tested" &&
          reached(status, step);
        const failed = step === "failed" && status === "failed";
        return (
          <li
            key={step}
            className={[
              "status-ladder__step",
              active ? "is-active" : "",
              passed ? "is-passed" : "",
              failed ? "is-failed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="status-ladder__marker">
              {passed ? "✓" : failed ? "×" : active && certifying ? "…" : "·"}
            </span>
            <span>{QR_STATUS_LABELS[step]}</span>
            {active && certifying && step !== "failed" && (
              <span className="status-ladder__working">working</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
