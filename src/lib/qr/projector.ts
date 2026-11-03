import { getBlock, type ProjectionClass } from "@/lib/blocks/registry";
import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import { worldToModule, type SiteLayout } from "@/lib/world/site";

export interface ProjectionConflict {
  x: number;
  z: number;
  row: number;
  col: number;
  block: string;
  actual: ProjectionClass | "missing";
  expected: "dark" | "light";
}

export interface ProjectionReport {
  matrixMatched: boolean;
  modules: number;
  columns: number;
  correctColumns: number;
  conflicts: number;
  neutralColumns: number;
  missingColumns: number;
  coverage: number;
  conflictedModules: number;
  examples: ProjectionConflict[];
}

export function projectWorld(world: VoxelWorld, layout: SiteLayout): ProjectionReport {
  const { qr, cellSize } = layout;
  const moduleCount = qr.size;
  const expectedCounts = new Int32Array(moduleCount * moduleCount);
  const correctCounts = new Int32Array(moduleCount * moduleCount);
  const neutralCounts = new Int32Array(moduleCount * moduleCount);
  const missingCounts = new Int32Array(moduleCount * moduleCount);
  let correctColumns = 0;
  let conflicts = 0;
  let neutralColumns = 0;
  let missingColumns = 0;
  const examples: ProjectionConflict[] = [];

  for (let z = layout.cityRect.z1; z <= layout.cityRect.z2; z++) {
    for (let x = layout.cityRect.x1; x <= layout.cityRect.x2; x++) {
      const { row, col } = worldToModule(layout, x, z);
      const index = row * moduleCount + col;
      const expected = qr.data[index] === 1 ? "dark" : "light";
      expectedCounts[index] += 1;
      const top = world.topBlock(x, z);
      if (!top) {
        missingColumns += 1;
        missingCounts[index] += 1;
        conflicts += 1;
        if (examples.length < 12) {
          examples.push({ x, z, row, col, block: "minecraft:air", actual: "missing", expected });
        }
        continue;
      }
      const projection = getBlock(top.id).projection;
      if (projection === expected) {
        correctColumns += 1;
        correctCounts[index] += 1;
      } else {
        conflicts += 1;
        if (projection === "neutral") neutralColumns += 1;
        if (projection === "neutral") neutralCounts[index] += 1;
        if (examples.length < 12) {
          examples.push({ x, z, row, col, block: top.id, actual: projection, expected });
        }
      }
    }
  }

  let conflictedModules = 0;
  const required = cellSize * cellSize;
  for (let i = 0; i < expectedCounts.length; i++) {
    if (correctCounts[i] !== required || expectedCounts[i] !== required) {
      conflictedModules += 1;
    }
    void neutralCounts[i];
    void missingCounts[i];
  }

  const columns = expectedCounts.reduce((sum, value) => sum + value, 0);
  return {
    matrixMatched: conflicts === 0 && columns === layout.citySize * layout.citySize,
    modules: moduleCount * moduleCount,
    columns,
    correctColumns,
    conflicts,
    neutralColumns,
    missingColumns,
    coverage: columns === 0 ? 0 : correctColumns / columns,
    conflictedModules,
    examples,
  };
}
