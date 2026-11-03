import { AIR, getBlock, hexToRgb, isOpaque } from "@/lib/blocks/registry";
import type { VoxelWorld } from "@/lib/world/VoxelWorld";

/**
 * A surface mesh of the visible voxel world. Internal faces are culled, so a
 * large world stays practical to export. Coordinates keep the generator's axes
 * (X east, Y up, Z south); the exporter subtracts the world centre so the model
 * is centred at the origin in common 3D viewers.
 */
export interface VoxelMesh {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  faceCount: number;
  triangleCount: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

interface FaceDefinition {
  normal: [number, number, number];
  corners: Array<[number, number, number]>;
}

const FACES: FaceDefinition[] = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

interface PaletteInfo {
  opaque: boolean;
  include: boolean;
  color: [number, number, number];
}

function paletteInfo(world: VoxelWorld, includeWater: boolean): PaletteInfo[] {
  return world.palette.map((id) => {
    if (id === AIR) return { opaque: false, include: false, color: [0, 0, 0] as [number, number, number] };
    const block = getBlock(id);
    const [r, g, b] = hexToRgb(block.color);
    return {
      opaque: isOpaque(id),
      include: includeWater || block.solid,
      color: [r / 255, g / 255, b / 255] as [number, number, number],
    };
  });
}

/**
 * Two-pass builder: the first pass counts faces so the typed output arrays are
 * allocated exactly once. No per-block objects are allocated.
 */
export function buildVoxelMesh(
  world: VoxelWorld,
  options: { includeWater?: boolean; center?: boolean } = {},
): VoxelMesh {
  const includeWater = options.includeWater ?? false;
  const center = options.center ?? true;
  const offsetX = center ? -world.sizeX / 2 : 0;
  const offsetZ = center ? -world.sizeZ / 2 : 0;
  const info = paletteInfo(world, includeWater);
  const blocks = world.blocks;
  const sizeX = world.sizeX;
  const sizeY = world.sizeY;
  const sizeZ = world.sizeZ;
  const plane = sizeX * sizeZ;
  const opaque = info.map((entry) => entry.opaque);
  const include = info.map((entry) => entry.include);

  let faceCount = 0;
  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      const base = y * plane + z * sizeX;
      for (let x = 0; x < sizeX; x++) {
        const index = base + x;
        const palette = blocks[index];
        if (palette === 0 || !include[palette]) continue;
        if (x + 1 >= sizeX || !opaque[blocks[index + 1]]) faceCount += 1;
        if (x === 0 || !opaque[blocks[index - 1]]) faceCount += 1;
        if (y + 1 >= sizeY || !opaque[blocks[index + plane]]) faceCount += 1;
        if (y === 0 || !opaque[blocks[index - plane]]) faceCount += 1;
        if (z + 1 >= sizeZ || !opaque[blocks[index + sizeX]]) faceCount += 1;
        if (z === 0 || !opaque[blocks[index - sizeX]]) faceCount += 1;
      }
    }
  }

  const vertexCount = faceCount * 4;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(faceCount * 6);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let face = 0;

  const writeFace = (
    x: number,
    y: number,
    z: number,
    faceIndex: number,
    color: [number, number, number],
  ) => {
    const definition = FACES[faceIndex];
    const vertexBase = face * 4;
    for (let corner = 0; corner < 4; corner++) {
      const [cx, cy, cz] = definition.corners[corner];
      const px = x + cx;
      const py = y + cy;
      const pz = z + cz;
      const offset = (vertexBase + corner) * 3;
      positions[offset] = px + offsetX;
      positions[offset + 1] = py;
      positions[offset + 2] = pz + offsetZ;
      normals[offset] = definition.normal[0];
      normals[offset + 1] = definition.normal[1];
      normals[offset + 2] = definition.normal[2];
      colors[offset] = color[0];
      colors[offset + 1] = color[1];
      colors[offset + 2] = color[2];
      min[0] = Math.min(min[0], px + offsetX);
      min[1] = Math.min(min[1], py);
      min[2] = Math.min(min[2], pz + offsetZ);
      max[0] = Math.max(max[0], px + offsetX);
      max[1] = Math.max(max[1], py);
      max[2] = Math.max(max[2], pz + offsetZ);
    }
    const indexOffset = face * 6;
    indices[indexOffset] = vertexBase;
    indices[indexOffset + 1] = vertexBase + 1;
    indices[indexOffset + 2] = vertexBase + 2;
    indices[indexOffset + 3] = vertexBase;
    indices[indexOffset + 4] = vertexBase + 2;
    indices[indexOffset + 5] = vertexBase + 3;
    face += 1;
  };

  for (let y = 0; y < sizeY; y++) {
    for (let z = 0; z < sizeZ; z++) {
      const base = y * plane + z * sizeX;
      for (let x = 0; x < sizeX; x++) {
        const index = base + x;
        const palette = blocks[index];
        if (palette === 0 || !include[palette]) continue;
        const color = info[palette].color;
        if (x + 1 >= sizeX || !opaque[blocks[index + 1]]) writeFace(x, y, z, 0, color);
        if (x === 0 || !opaque[blocks[index - 1]]) writeFace(x, y, z, 1, color);
        if (y + 1 >= sizeY || !opaque[blocks[index + plane]]) writeFace(x, y, z, 2, color);
        if (y === 0 || !opaque[blocks[index - plane]]) writeFace(x, y, z, 3, color);
        if (z + 1 >= sizeZ || !opaque[blocks[index + sizeX]]) writeFace(x, y, z, 4, color);
        if (z === 0 || !opaque[blocks[index - sizeX]]) writeFace(x, y, z, 5, color);
      }
    }
  }

  return {
    positions,
    normals,
    colors,
    indices,
    vertexCount,
    faceCount,
    triangleCount: faceCount * 2,
    bounds: {
      min: Number.isFinite(min[0]) ? min : [0, 0, 0],
      max: Number.isFinite(max[0]) ? max : [0, 0, 0],
    },
  };
}
