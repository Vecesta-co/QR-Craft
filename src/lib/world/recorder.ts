import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import type { BuildPhase, Placement } from "@/lib/world/types";

/** Writes city blocks and records every change for the builder task graph. */
export class PlacementRecorder {
  readonly world: VoxelWorld;
  readonly placements: Placement[] = [];
  /** Voxel index -> placement, so later detail passes replace in O(1). */
  private readonly changed = new Map<number, Placement>();

  constructor(world: VoxelWorld) {
    this.world = world;
  }

  place(
    x: number,
    y: number,
    z: number,
    block: string,
    phase: BuildPhase,
    group: string,
  ): boolean {
    if (!this.world.inBounds(x, y, z)) return false;
    const index = this.world.index(x, y, z);
    const previous = this.changed.get(index);
    if (previous) {
      // Later passes may legitimately carve details; keep the last placement
      // but avoid duplicate task entries by replacing the previous one.
      previous.block = block;
      previous.phase = phase;
      previous.group = group;
      this.world.set(x, y, z, block);
      return true;
    }
    if (this.world.get(x, y, z) === block) return false;
    this.world.set(x, y, z, block);
    const placement: Placement = { x, y, z, block, phase, group };
    this.changed.set(index, placement);
    this.placements.push(placement);
    return true;
  }

  fill(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    block: string,
    phase: BuildPhase,
    group: string,
  ): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          this.place(x, y, z, block, phase, group);
        }
      }
    }
  }

  column(
    x: number,
    z: number,
    fromY: number,
    toY: number,
    block: string,
    phase: BuildPhase,
    group: string,
  ): void {
    this.fill(x, fromY, z, x, toY, z, block, phase, group);
  }
}
