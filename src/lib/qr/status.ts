export type QrCertificationStatus =
  | "not-tested"
  | "matrix-matched"
  | "rendered-decoded"
  | "robustness-passed"
  | "failed";

export const QR_STATUS_LABELS: Record<QrCertificationStatus, string> = {
  "not-tested": "Not tested",
  "matrix-matched": "Matrix matched",
  "rendered-decoded": "Rendered image decoded",
  "robustness-passed": "Robustness tests passed",
  failed: "Certification failed",
};

export function isVerifiedStatus(status: QrCertificationStatus): boolean {
  return status === "rendered-decoded" || status === "robustness-passed";
}

export interface CertificationState {
  status: QrCertificationStatus;
  message: string;
  payloadMatched: boolean;
  renderedWidth: number | null;
  renderedHeight: number | null;
  robustnessPassed: number;
  robustnessTotal: number;
  checkedAt: string | null;
  /** Small preview of the actual offscreen capture, for human inspection. */
  captureDataUrl?: string | null;
}

export const EMPTY_CERTIFICATION: CertificationState = {
  status: "not-tested",
  message: "Generate a world to begin certification.",
  payloadMatched: false,
  renderedWidth: null,
  renderedHeight: null,
  robustnessPassed: 0,
  robustnessTotal: 0,
  checkedAt: null,
  captureDataUrl: null,
};
