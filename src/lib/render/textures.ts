import * as THREE from "three";
import { getBlock, hexToRgb, type BlockDefinition, type TextureKind } from "@/lib/blocks/registry";

export const TEXTURE_SIZE = 16;

const cache = new Map<string, THREE.CanvasTexture>();

function seedFor(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function noise(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shade(
  color: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    Math.max(0, Math.min(255, Math.round(color[0] * amount))),
    Math.max(0, Math.min(255, Math.round(color[1] * amount))),
    Math.max(0, Math.min(255, Math.round(color[2] * amount))),
  ];
}

function patternFactor(kind: TextureKind, x: number, y: number, n: number): number {
  let factor = 0.9 + n * 0.2;
  if (kind === "stoneBrick" || kind === "tile") {
    const row = Math.floor(y / 4);
    const mortarY = y % 4 === 0;
    const offset = row % 2 === 0 ? 0 : 4;
    const mortarX = (x + offset) % 8 === 0;
    if (mortarY || mortarX) factor = 0.62;
    else factor *= 0.94 + ((x * 7 + y * 3) % 5) * 0.012;
  } else if (kind === "cobble") {
    const cellX = Math.floor(x / 4) + Math.floor(y / 5) * 2;
    const cellY = Math.floor(y / 4);
    if (x % 4 === 0 || y % 4 === 0) factor = 0.7;
    factor *= 0.92 + ((cellX * 13 + cellY * 7) % 7) * 0.018;
  } else if (kind === "planks") {
    if (y % 4 === 3) factor = 0.68;
    factor *= 0.93 + ((x * 11 + y * 5) % 6) * 0.014;
  } else if (kind === "log") {
    if (x % 5 === 0) factor = 0.72;
    factor *= 0.92 + ((x * 3) % 5) * 0.02;
  } else if (kind === "leaves") {
    if (n < 0.24) factor = 0.62;
    else if (n > 0.8) factor = 1.18;
  } else if (kind === "grass") {
    if (n > 0.72) factor = 1.16;
    if (n < 0.18) factor = 0.76;
  } else if (kind === "dirt" || kind === "gravel") {
    if (n < 0.2) factor = 0.6;
    else if (n > 0.85) factor = 1.22;
  } else if (kind === "concrete" || kind === "snow") {
    factor = 0.98 + n * 0.04;
  } else if (kind === "mineral") {
    if (n > 0.9) factor = 1.12;
    else factor = 0.97 + n * 0.06;
  } else if (kind === "fabric") {
    if (x % 4 === 0 || y % 4 === 0) factor *= 0.88;
  } else if (kind === "metal") {
    if ((x + y) % 8 === 0) factor = 1.2;
    else if ((x + y) % 8 === 1) factor = 0.74;
  } else if (kind === "thatch") {
    if (y % 4 === 0) factor *= 0.84;
    if (x % 2 === 0) factor *= 1.04;
  } else if (kind === "sand") {
    if (n > 0.9) factor = 1.1;
    else if (n < 0.1) factor = 0.9;
  } else if (kind === "water") {
    factor = 0.9 + Math.sin((x + y * 2) * 0.8) * 0.06 + n * 0.06;
  } else if (kind === "glow") {
    const dx = x - 8;
    const dy = y - 8;
    factor = 1.2 - Math.min(0.35, Math.hypot(dx, dy) / 22);
  }
  return factor;
}

/**
 * Pure RGBA pixel data for one original 16 x 16 procedural texture. Keeping
 * this free of canvas/DOM APIs lets the standalone HTML exporter embed exactly
 * the same textures that the live view uses, and lets tests verify them in Node.
 */
export function buildTexturePixels(block: BlockDefinition): Uint8Array {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  const base = hexToRgb(block.color);
  const seed = seedFor(block.id);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const n = noise(seed, x, y);
      const [r, g, b] = shade(base, patternFactor(block.texture, x, y, n));
      const index = (y * TEXTURE_SIZE + x) * 4;
      pixels[index] = r;
      pixels[index + 1] = g;
      pixels[index + 2] = b;
      pixels[index + 3] = 255;
    }
  }
  // A subtle darker frame makes adjacent blocks read as separate cubes. This
  // matches the original 16% black overlay while staying canvas-free.
  for (let i = 0; i < TEXTURE_SIZE; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, TEXTURE_SIZE - 1],
      [0, i],
      [TEXTURE_SIZE - 1, i],
    ] as const) {
      const index = (y * TEXTURE_SIZE + x) * 4;
      pixels[index] = Math.round(pixels[index] * 0.84);
      pixels[index + 1] = Math.round(pixels[index + 1] * 0.84);
      pixels[index + 2] = Math.round(pixels[index + 2] * 0.84);
    }
  }
  return pixels;
}

export function createProceduralTexture(block: BlockDefinition): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable for block textures.");
  const image = ctx.createImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  image.data.set(buildTexturePixels(block));
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function getBlockTexture(blockId: string): THREE.Texture {
  const existing = cache.get(blockId);
  if (existing) return existing;
  const texture = createProceduralTexture(getBlock(blockId));
  cache.set(blockId, texture);
  return texture;
}

export function disposeBlockTextures(): void {
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}
