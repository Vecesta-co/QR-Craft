import {
  BUILD_PHASES,
  PHASE_LABELS,
  type BuildPhase,
  type BuildPlan,
  type BuildTask,
  type Placement,
  type SceneScore,
  type WorldBrief,
} from "@/lib/world/types";

const PHASE_ORDER: Record<BuildPhase, number> = {
  ground: 0,
  foundation: 1,
  walls: 2,
  roofs: 3,
  details: 4,
};

const MAX_BLOCKS_PER_TASK = 1200;

function groupLabel(group: string): string {
  if (group === "city-ground") return "the city paving";
  if (group === "city-roads") return "the avenues";
  if (group === "city-approach") return "the processional approach";
  if (group === "market-plaza") return "the market plaza";
  if (group === "market-monument") return "the market monument";
  if (group === "market-stalls") return "the market stalls";
  if (group === "castle-towers") return "the High Keep towers";
  if (group === "castle-walls") return "the castle curtain wall";
  if (group === "castle-keep") return "the High Keep";
  if (group === "castle-gate") return "the castle gatehouse";
  if (group === "cathedral-towers") return "the cathedral towers";
  if (group === "cathedral-nave") return "the Grand Cathedral";
  if (group === "cathedral-spire") return "the cathedral flèche";
  if (group === "cathedral-buttresses") return "the cathedral buttresses";
  if (group === "bastion-walls") return "the East Bastion walls";
  if (group === "bastion-towers") return "the East Bastion towers";
  if (group === "bastion-drum") return "the East Bastion drum tower";
  if (group === "bastion-gate") return "the East Bastion gate";
  if (group.startsWith("house-")) return "a townhouse";
  if (group.startsWith("manor-")) return "a manor";
  if (group.startsWith("tower-")) return "a watchtower";
  if (group.startsWith("stall-")) return "a market stall";
  return group.replace(/-/g, " ");
}

function taskLabel(group: string, phase: BuildPhase): string {
  const subject = groupLabel(group);
  if (phase === "ground") {
    if (group === "city-approach") return "Paving the processional approach";
    if (group === "market-plaza") return "Paving the market plaza";
    return `Paving ${subject}`;
  }
  if (phase === "foundation") return `Setting the foundations of ${subject}`;
  if (phase === "walls") return `Raising the walls of ${subject}`;
  if (phase === "roofs") return `Raising the roofs of ${subject}`;
  return `Finishing ${subject}`;
}

interface TaskSeed {
  id: string;
  group: string;
  phase: BuildPhase;
  blocks: Placement[];
  firstInGroupPhase: boolean;
}

function chunks(idBase: string, blocks: Placement[]): Placement[][] {
  if (blocks.length <= MAX_BLOCKS_PER_TASK) return [blocks];
  const result: Placement[][] = [];
  for (let start = 0; start < blocks.length; start += MAX_BLOCKS_PER_TASK) {
    result.push(blocks.slice(start, start + MAX_BLOCKS_PER_TASK));
  }
  return result;
}

export function compileBuildPlan(
  placements: Placement[],
  brief: WorldBrief,
  score: SceneScore,
): BuildPlan {
  const groupOrder = new Map<string, number>();
  for (const placement of placements) {
    if (!groupOrder.has(placement.group)) groupOrder.set(placement.group, groupOrder.size);
  }

  const grouped = new Map<string, Placement[]>();
  for (const placement of placements) {
    const key = `${placement.group}|${placement.phase}`;
    const list = grouped.get(key);
    if (list) list.push(placement);
    else grouped.set(key, [placement]);
  }

  const seeds: TaskSeed[] = [];
  for (const [key, list] of grouped) {
    const [group, phase] = key.split("|") as [string, BuildPhase];
    const parts = chunks(key, list);
    parts.forEach((part, index) => {
      seeds.push({
        id: `${group}.${phase}.${index}`,
        group,
        phase,
        blocks: part,
        firstInGroupPhase: index === 0,
      });
    });
  }

  seeds.sort((a, b) => {
    const phase = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
    if (phase !== 0) return phase;
    const group = (groupOrder.get(a.group) ?? 0) - (groupOrder.get(b.group) ?? 0);
    if (group !== 0) return group;
    return a.id.localeCompare(b.id, "en", { numeric: true });
  });

  const byGroupPhase = new Map<string, TaskSeed[]>();
  for (const seed of seeds) {
    const key = `${seed.group}|${seed.phase}`;
    const list = byGroupPhase.get(key);
    if (list) list.push(seed);
    else byGroupPhase.set(key, [seed]);
  }

  const groundSeeds = seeds.filter((seed) => seed.phase === "ground");
  const groundGroupLast = new Map<string, string>();
  for (const seed of groundSeeds) {
    groundGroupLast.set(seed.group, seed.id);
  }
  const groundDependencies = [...groundGroupLast.values()];

  const tasks: BuildTask[] = [];
  for (const seed of seeds) {
    const dependsOn: string[] = [];
    const previousPhaseIndex = BUILD_PHASES.indexOf(seed.phase) - 1;
    if (previousPhaseIndex >= 0) {
      const previousPhase = BUILD_PHASES[previousPhaseIndex];
      const previous = byGroupPhase.get(`${seed.group}|${previousPhase}`);
      if (previous && previous.length > 0) {
        dependsOn.push(previous[previous.length - 1].id);
      }
    }

    // Chain chunks within one group phase.
    const siblings = byGroupPhase.get(`${seed.group}|${seed.phase}`) ?? [];
    const siblingIndex = siblings.findIndex((item) => item.id === seed.id);
    if (siblingIndex > 0) {
      dependsOn.push(siblings[siblingIndex - 1].id);
    }

    // All building work starts after the complete ground pass.
    if (seed.phase !== "ground" && seed.firstInGroupPhase) {
      for (const id of groundDependencies) {
        if (!dependsOn.includes(id)) dependsOn.push(id);
      }
    }

    // Global phase gate: no group starts a phase until the previous phase is
    // complete across all groups that have work in it.
    if (seed.phase !== "ground" && seed.firstInGroupPhase) {
      const previousPhaseIndexGlobal = BUILD_PHASES.indexOf(seed.phase) - 1;
      if (previousPhaseIndexGlobal >= 0) {
        const previousGlobalPhase = BUILD_PHASES[previousPhaseIndexGlobal];
        for (const candidate of seeds) {
          if (candidate.phase !== previousGlobalPhase) continue;
          const groupPhase = byGroupPhase.get(`${candidate.group}|${candidate.phase}`) ?? [];
          const last = groupPhase[groupPhase.length - 1];
          if (last && last.id !== seed.id && !dependsOn.includes(last.id)) dependsOn.push(last.id);
        }
      }
    }

    const anchorSum = seed.blocks.reduce(
      (sum, block) => ({ x: sum.x + block.x, y: sum.y + block.y, z: sum.z + block.z }),
      { x: 0, y: 0, z: 0 },
    );
    const count = Math.max(1, seed.blocks.length);
    tasks.push({
      id: seed.id,
      label: taskLabel(seed.group, seed.phase),
      group: seed.group,
      phase: seed.phase,
      anchor: {
        x: anchorSum.x / count + 0.5,
        y: anchorSum.y / count + 0.5,
        z: anchorSum.z / count + 0.5,
      },
      blocks: seed.blocks,
      dependsOn,
    });
  }

  return {
    tasks,
    totalBlocks: placements.length,
    groups: [...groupOrder.keys()],
    brief,
    score,
  };
}

export function phaseOrder(phase: BuildPhase): number {
  return PHASE_ORDER[phase];
}

export function phaseLabel(phase: BuildPhase): string {
  return PHASE_LABELS[phase];
}
