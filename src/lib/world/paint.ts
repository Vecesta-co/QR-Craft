import { materialsFor, STYLES, type MaterialSet } from "@/lib/blocks/registry";
import { worldToModule, type SiteLayout } from "@/lib/world/site";
import type { StyleId } from "@/lib/blocks/registry";

/**
 * Shared, QR-aware painting helpers.
 *
 * Every visible top surface in the city must use the material class of the QR
 * module underneath it. These helpers resolve a world column to its module and
 * return only blocks from the matching (dark or light) palette. That invariant
 * is what lets the actual architecture form the QR projection without an
 * overlaid texture.
 */
export interface PaintContext {
  layout: SiteLayout;
  style: StyleId;
}

export function moduleDarkAt(layout: SiteLayout, x: number, z: number): boolean {
  const { row, col } = worldToModule(layout, x, z);
  if (row < 0 || col < 0 || row >= layout.qr.size || col >= layout.qr.size) {
    return false;
  }
  return layout.qr.data[row * layout.qr.size + col] === 1;
}

export function materialsAt(ctx: PaintContext, x: number, z: number): MaterialSet {
  return materialsFor(ctx.style, moduleDarkAt(ctx.layout, x, z));
}

export function groundAt(ctx: PaintContext, x: number, z: number): string {
  const set = materialsAt(ctx, x, z);
  return set.ground[Math.abs(x * 5 + z * 11) % set.ground.length];
}

export function foundationAt(ctx: PaintContext, x: number, z: number): string {
  const structure = STYLES[ctx.style].structure;
  return moduleDarkAt(ctx.layout, x, z)
    ? (structure.darkFoundation ?? structure.foundation)
    : (structure.lightFoundation ?? structure.foundation);
}

/**
 * Side-facing wall material. It is deliberately independent of the QR class:
 * the topmost block of every column is what the projector checks, and roofs,
 * ground and battlements already supply the dark/light projection.
 */
export function wallAt(ctx: PaintContext, x: number, y: number, z: number): string {
  const structure = STYLES[ctx.style].structure;
  const palette = moduleDarkAt(ctx.layout, x, z)
    ? (structure.darkWall ?? structure.wall)
    : (structure.lightWall ?? structure.wall);
  if (palette.length === 1) return palette[0];
  const hash = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0;
  // Keep one dominant masonry material and scatter the others, instead of
  // cycling every few blocks into a checkerboard.
  if (hash % 100 < 74) return palette[0];
  return palette[1 + ((hash >>> 9) % (palette.length - 1))];
}

export function wallTrimAt(ctx: PaintContext, x: number, z: number): string {
  return materialsAt(ctx, x, z).trim;
}

export function accentAt(ctx: PaintContext, x: number, z: number): string {
  return materialsAt(ctx, x, z).accent;
}

export function roofAt(ctx: PaintContext, x: number, z: number, layer = 0): string {
  const set = materialsAt(ctx, x, z);
  if (layer === 0) return set.roofEdge;
  return set.roof[(layer + Math.abs(x + z)) % set.roof.length];
}

export function roofCapAt(ctx: PaintContext, x: number, z: number): string {
  return materialsAt(ctx, x, z).roof[0];
}

export function doorAt(ctx: PaintContext, x: number, z: number): string {
  return materialsAt(ctx, x, z).door;
}

export function windowAt(ctx: PaintContext, x: number, z: number): string {
  return materialsAt(ctx, x, z).window;
}

export function canopyAt(ctx: PaintContext, x: number, z: number): string {
  return moduleDarkAt(ctx.layout, x, z) ? "minecraft:black_wool" : "minecraft:white_wool";
}
