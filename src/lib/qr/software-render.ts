import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { getBlock, hexToRgb } from "@/lib/blocks/registry";
import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import type { SiteLayout } from "@/lib/world/site";

export interface TopViewImage {
  width: number;
  height: number;
  /** Row-major luminance, top row first. */
  luminance: Uint8ClampedArray;
  /** Row-major RGBA, top row first. */
  rgba: Uint8ClampedArray;
  scale: number;
  crop: { x1: number; z1: number; x2: number; z2: number };
}

export interface DecodeResult {
  decoded: boolean;
  text: string | null;
  payloadMatched: boolean;
  error: string | null;
  width: number;
  height: number;
}

/**
 * Render the actual top projection of the voxel world. Each pixel is sampled
 * from the top block of the corresponding world column; no QR texture or
 * overlay is involved. The crop includes the city's real esplanade so the
 * quiet zone is surrounded by the same light stone used in the scene.
 */
export function renderTopView(
  world: VoxelWorld,
  layout: SiteLayout,
  options: { marginBlocks?: number; maxEdge?: number } = {},
): TopViewImage {
  const margin = options.marginBlocks ?? Math.max(4, Math.ceil(layout.esplanadeWidth / 2));
  // A realistic capture scale. Very large integer upscales of the same QR can
  // defeat ZXing's local binarizer on high-frequency material patterns, while
  // a phone camera would see the code at roughly this pixel density.
  const maxEdge = options.maxEdge ?? 600;
  const x1 = Math.max(0, layout.cityRect.x1 - margin);
  const z1 = Math.max(0, layout.cityRect.z1 - margin);
  const x2 = Math.min(world.sizeX - 1, layout.cityRect.x2 + margin);
  const z2 = Math.min(world.sizeZ - 1, layout.cityRect.z2 + margin);
  const blocksWide = x2 - x1 + 1;
  const blocksDeep = z2 - z1 + 1;
  const scale = Math.max(2, Math.min(12, Math.floor(maxEdge / Math.max(blocksWide, blocksDeep))));
  const width = blocksWide * scale;
  const height = blocksDeep * scale;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const luminance = new Uint8ClampedArray(width * height);

  const fallback: [number, number, number] = [128, 128, 128];
  for (let bz = 0; bz < blocksDeep; bz++) {
    for (let bx = 0; bx < blocksWide; bx++) {
      const top = world.topBlock(x1 + bx, z1 + bz);
      const color = top ? hexToRgb(getBlock(top.id).color) : fallback;
      const lum = Math.round(0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]);
      for (let py = 0; py < scale; py++) {
        const row = bz * scale + py;
        for (let px = 0; px < scale; px++) {
          const index = row * width + bx * scale + px;
          luminance[index] = lum;
          rgba[index * 4] = color[0];
          rgba[index * 4 + 1] = color[1];
          rgba[index * 4 + 2] = color[2];
          rgba[index * 4 + 3] = 255;
        }
      }
    }
  }

  return { width, height, luminance, rgba, scale, crop: { x1, z1, x2, z2 } };
}

/** Decode an actual rendered top-view image and compare the payload exactly. */
export function decodeTopView(image: TopViewImage, expectedPayload: string): DecodeResult {
  const source = new RGBLuminanceSource(image.luminance, image.width, image.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  const reader = new MultiFormatReader();
  try {
    const result = reader.decode(bitmap, hints);
    const text = result.getText();
    return {
      decoded: true,
      text,
      payloadMatched: text === expectedPayload,
      error: null,
      width: image.width,
      height: image.height,
    };
  } catch (error) {
    return {
      decoded: false,
      text: null,
      payloadMatched: false,
      error: error instanceof Error ? error.message : String(error),
      width: image.width,
      height: image.height,
    };
  } finally {
    reader.reset();
  }
}

export function certifyTopView(
  world: VoxelWorld,
  layout: SiteLayout,
  expectedPayload: string,
): DecodeResult {
  return decodeTopView(renderTopView(world, layout), expectedPayload);
}
