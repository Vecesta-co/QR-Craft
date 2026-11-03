import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import type { BuildPlan } from "@/lib/world/types";

/**
 * Instanced render data for the construction site.
 *
 * The static terrain is taken from the bare site. Every block that the build
 * plan will place is omitted from the static set, then added again from the
 * completed world with the construction order at which it appears. `orders`
 * therefore forms a prefix that can be revealed exactly as the builder applies
 * placements to the live world.
 */
export interface RenderPayload {
  count: number;
  /** x, y, z triplets. */
  positions: Uint16Array;
  /** Palette index into the world snapshot palette. */
  paletteIndices: Uint16Array;
  /** Construction order, or -1 for pre-existing terrain. */
  orders: Int32Array;
}

function exposedPaletteIndices(world: VoxelWorld): number[] {
  const indices: number[] = [];
  for (let y = 0; y < world.sizeY; y++) {
    for (let z = 0; z < world.sizeZ; z++) {
      for (let x = 0; x < world.sizeX; x++) {
        if (world.isExposed(x, y, z)) indices.push(world.index(x, y, z));
      }
    }
  }
  return indices;
}

export function buildRenderPayload(
  bareWorld: VoxelWorld,
  completedWorld: VoxelWorld,
  plan: BuildPlan,
): RenderPayload {
  const orderByVoxel = new Map<number, number>();
  let order = 0;
  for (const task of plan.tasks) {
    for (const block of task.blocks) {
      if (!completedWorld.inBounds(block.x, block.y, block.z)) continue;
      orderByVoxel.set(completedWorld.index(block.x, block.y, block.z), order);
      order += 1;
    }
  }

  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const paletteIndices: number[] = [];
  const orders: number[] = [];

  const push = (world: VoxelWorld, index: number, instanceOrder: number) => {
    const x = index % world.sizeX;
    const z = Math.floor(index / world.sizeX) % world.sizeZ;
    const y = Math.floor(index / (world.sizeX * world.sizeZ));
    xs.push(x);
    ys.push(y);
    zs.push(z);
    paletteIndices.push(world.blocks[index]);
    orders.push(instanceOrder);
  };

  for (const index of exposedPaletteIndices(bareWorld)) {
    if (orderByVoxel.has(index)) continue;
    push(bareWorld, index, -1);
  }
  for (const index of exposedPaletteIndices(completedWorld)) {
    const instanceOrder = orderByVoxel.get(index);
    if (instanceOrder === undefined) continue;
    push(completedWorld, index, instanceOrder);
  }

  const count = xs.length;
  const positions = new Uint16Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = xs[i];
    positions[i * 3 + 1] = ys[i];
    positions[i * 3 + 2] = zs[i];
  }
  return {
    count,
    positions,
    paletteIndices: Uint16Array.from(paletteIndices),
    orders: Int32Array.from(orders),
  };
}
