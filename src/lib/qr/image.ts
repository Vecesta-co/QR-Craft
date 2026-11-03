import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface ImageDecode {
  decoded: boolean;
  text: string | null;
  error: string | null;
}

const QR_HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
]);

export function rgbaToLuminance(image: RgbaImage): Uint8ClampedArray {
  const { width, height, data } = image;
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    luminance[i] = (r * 77 + g * 150 + b * 29) >> 8;
  }
  return luminance;
}

export function decodeLuminance(luminance: Uint8ClampedArray, width: number, height: number): ImageDecode {
  const source = new RGBLuminanceSource(luminance, width, height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const reader = new MultiFormatReader();
  try {
    const result = reader.decode(bitmap, QR_HINTS);
    return { decoded: true, text: result.getText(), error: null };
  } catch (error) {
    return {
      decoded: false,
      text: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    reader.reset();
  }
}

export function decodeRgbaImage(image: RgbaImage): ImageDecode {
  const luminance = rgbaToLuminance(image);
  const normal = decodeLuminance(luminance, image.width, image.height);
  if (normal.decoded) return normal;
  const inverted = new Uint8ClampedArray(luminance.length);
  for (let i = 0; i < luminance.length; i++) inverted[i] = 255 - luminance[i];
  const invertedResult = decodeLuminance(inverted, image.width, image.height);
  return invertedResult.decoded ? invertedResult : normal;
}

export async function decodeQrImageFile(file: File): Promise<string> {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("Upload a PNG, JPEG, or WebP image containing a QR code.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("That image is larger than 20 MB. Use a smaller export.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("The image could not be read. Try exporting it again as PNG.");
  }
  const maxEdge = 1800;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("The browser could not create a canvas for image decoding.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const imageData = context.getImageData(0, 0, width, height);
  const result = decodeRgbaImage({ width, height, data: imageData.data });
  if (!result.decoded || !result.text) {
    throw new Error("No QR code could be decoded from that image.");
  }
  return result.text;
}
