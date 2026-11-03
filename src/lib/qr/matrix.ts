import QRCode from "qrcode";

export const ERROR_CORRECTION_LEVELS = ["L", "M", "Q", "H"] as const;
export type ErrorCorrectionLevel = (typeof ERROR_CORRECTION_LEVELS)[number];

/**
 * Canonical QR matrix used by world generation.
 *
 * Conventions:
 * - `data` is row-major: index = row * size + col.
 * - 1 means a dark module, 0 means a light module.
 * - Row 0 is the top row of the printed symbol.
 * - `quietZone` modules have already been added on every side.
 */
export interface QRMatrix {
  payload: string;
  /** Size in modules, including the quiet zone. */
  size: number;
  /** Size of the bare symbol in modules, excluding the quiet zone. */
  moduleCount: number;
  quietZone: number;
  version: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  data: Uint8Array;
}

export interface CreateQrOptions {
  errorCorrectionLevel?: ErrorCorrectionLevel;
  quietZone?: number;
}

export function createQrMatrix(payload: string, options: CreateQrOptions = {}): QRMatrix {
  if (!payload.trim()) {
    throw new Error("Enter a URL or some text to encode.");
  }

  const errorCorrectionLevel = options.errorCorrectionLevel ?? "M";
  const quietZone = options.quietZone ?? 4;
  if (!Number.isInteger(quietZone) || quietZone < 0 || quietZone > 16) {
    throw new Error("Quiet zone must be an integer between 0 and 16 modules.");
  }

  let encoded: QRCode.QRCode;
  try {
    encoded = QRCode.create(payload, {
      errorCorrectionLevel,
      version: undefined,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/too (big|long)|overflow/i.test(detail)) {
      throw new Error("That payload is too large for a QR code. Shorten the text or URL.");
    }
    throw new Error(`Could not create a QR code: ${detail}`);
  }

  const moduleCount = encoded.modules.size;
  const size = moduleCount + quietZone * 2;
  const data = new Uint8Array(size * size);

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      const value = encoded.modules.get(row, col) ? 1 : 0;
      data[(row + quietZone) * size + col + quietZone] = value;
    }
  }

  return {
    payload,
    size,
    moduleCount,
    quietZone,
    version: encoded.version,
    errorCorrectionLevel,
    data,
  };
}

export function moduleAt(matrix: QRMatrix, row: number, col: number): number {
  if (row < 0 || col < 0 || row >= matrix.size || col >= matrix.size) {
    throw new Error(`Module (${row}, ${col}) is outside the QR matrix.`);
  }
  return matrix.data[row * matrix.size + col];
}

/** Finder-pattern origins in matrix coordinates, including the quiet zone offset. */
export function finderOrigins(matrix: QRMatrix): Array<{ row: number; col: number }> {
  const q = matrix.quietZone;
  const last = q + matrix.moduleCount - 7;
  return [
    { row: q, col: q },
    { row: q, col: last },
    { row: last, col: q },
  ];
}

export function finderRole(origin: { row: number; col: number }, matrix: QRMatrix): "high-keep" | "east-bastion" | "cathedral" {
  const q = matrix.quietZone;
  const last = q + matrix.moduleCount - 7;
  if (origin.row === q && origin.col === q) return "high-keep";
  if (origin.row === q && origin.col === last) return "east-bastion";
  return "cathedral";
}

export function isFinderCell(matrix: QRMatrix, row: number, col: number): boolean {
  return finderOrigins(matrix).some(
    (origin) => row >= origin.row && row < origin.row + 7 && col >= origin.col && col < origin.col + 7,
  );
}
