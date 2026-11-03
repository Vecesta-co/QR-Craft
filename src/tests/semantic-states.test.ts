import minecraftData from "minecraft-data";
import { describe, expect, it } from "vitest";
import { BLOCKS } from "@/lib/blocks/registry";
import { parseBlockState } from "@/lib/blocks/state";
import {
  chainState,
  doorStates,
  fenceFor,
  fenceState,
  ironBarsState,
  lanternState,
  slabFor,
  slabState,
  soulLanternState,
  stairFor,
  stairState,
  trapdoorFor,
  trapdoorState,
  wallFor,
  wallState,
  type Facing,
  type Half,
} from "@/lib/world/semantic";

const data = minecraftData("1.21.4");
const FACINGS: readonly Facing[] = ["north", "south", "east", "west"];
const HALVES: readonly Half[] = ["bottom", "top"];

function propertyIssues(state: string): string[] {
  const issues: string[] = [];
  const { base, props } = parseBlockState(state);
  const name = base.slice("minecraft:".length);
  const block = data.blocksByName[name];
  if (!block) return [`unknown block ${base}`];
  const definitions = new Map((block.states ?? []).map((entry) => [entry.name, entry]));
  for (const [key, value] of Object.entries(props)) {
    const definition = definitions.get(key);
    if (!definition) {
      issues.push(`${base} has no property ${key}`);
      continue;
    }
    if (definition.type === "bool") {
      if (value !== "true" && value !== "false") {
        issues.push(`${base}.${key} must be a boolean, got ${value}`);
      }
    } else if (definition.type === "enum" || definition.type === "direction") {
      const allowed = (definition.values ?? []).map(String);
      if (!allowed.includes(value)) {
        issues.push(`${base}.${key} does not allow ${value}`);
      }
    } else if (definition.type === "int" && !/^-?\d+$/.test(value)) {
      issues.push(`${base}.${key} must be an integer, got ${value}`);
    }
  }
  return issues;
}

function props(state: string): Record<string, string> {
  return parseBlockState(state).props;
}

describe("semantic block states", () => {
  it("validates every stair, slab, fence, wall and trapdoor mapping against 1.21.4", () => {
    const issues: string[] = [];
    const check = (state: string, label: string) => {
      issues.push(...propertyIssues(state).map((issue) => `${label}: ${issue}`));
    };

    for (const base of Object.keys(BLOCKS)) {
      const stair = stairFor(base);
      if (stair) {
        for (const facing of FACINGS) {
          for (const half of HALVES) {
            const state = stairState(stair, facing, half);
            check(state, `stair ${base}`);
            expect(parseBlockState(state).base, `stair base for ${base}`).toBe(stair);
          }
        }
      }

      const slab = slabFor(base);
      if (slab) {
        for (const half of HALVES) {
          const state = slabState(slab, half);
          check(state, `slab ${base}`);
          expect(props(state).type).toBe(half === "top" ? "top" : "bottom");
        }
      }

      const fence = fenceFor(base);
      if (fence) {
        for (const connected of [true, false]) {
          const state = fenceState(fence, connected);
          check(state, `fence ${base}`);
          const stateProps = props(state);
          expect(stateProps.east).toBe(String(connected));
          expect(stateProps.north).toBe(String(connected));
          expect(stateProps.south).toBe(String(connected));
          expect(stateProps.west).toBe(String(connected));
        }
      }

      const wall = wallFor(base);
      if (wall) {
        for (const connected of [true, false]) {
          const state = wallState(wall, connected);
          check(state, `wall ${base}`);
          const stateProps = props(state);
          const side = connected ? "tall" : "none";
          for (const direction of ["east", "north", "south", "west"] as const) {
            expect(stateProps[direction], `${wall}.${direction}`).toBe(side);
          }
          expect(stateProps.up).toBe(String(connected));
        }
      }

      const trapdoor = trapdoorFor(base);
      if (trapdoor) {
        for (const facing of FACINGS) {
          for (const half of HALVES) {
            const state = trapdoorState(trapdoor, facing, true, half);
            check(state, `trapdoor ${base}`);
            expect(props(state).facing).toBe(facing);
            expect(props(state).half).toBe(half);
            expect(props(state).open).toBe("true");
          }
        }
      }
    }

    expect(issues).toEqual([]);
  });

  it("emits exact property sets for doors, slabs, stairs, fences, walls, trapdoors and lanterns", () => {
    expect(props(stairState("minecraft:stone_brick_stairs", "east", "top"))).toEqual({
      facing: "east",
      half: "top",
      shape: "straight",
      waterlogged: "false",
    });
    expect(props(slabState("minecraft:stone_brick_slab", "top"))).toEqual({
      type: "top",
      waterlogged: "false",
    });
    expect(props(fenceState("minecraft:dark_oak_fence", false))).toEqual({
      east: "false",
      north: "false",
      south: "false",
      waterlogged: "false",
      west: "false",
    });
    expect(props(wallState("minecraft:stone_brick_wall", true))).toEqual({
      east: "tall",
      north: "tall",
      south: "tall",
      up: "true",
      waterlogged: "false",
      west: "tall",
    });
    expect(props(wallState("minecraft:stone_brick_wall", false))).toEqual({
      east: "none",
      north: "none",
      south: "none",
      up: "false",
      waterlogged: "false",
      west: "none",
    });
    expect(props(trapdoorState("minecraft:dark_oak_trapdoor", "south", true, "top"))).toEqual({
      facing: "south",
      half: "top",
      open: "true",
      powered: "false",
      waterlogged: "false",
    });
    expect(props(lanternState(true))).toEqual({ hanging: "true", waterlogged: "false" });
    expect(props(soulLanternState(false))).toEqual({ hanging: "false", waterlogged: "false" });
    expect(props(ironBarsState())).toEqual({
      east: "false",
      north: "false",
      south: "false",
      waterlogged: "false",
      west: "false",
    });
    expect(props(chainState("x"))).toEqual({ axis: "x", waterlogged: "false" });

    const [lower, upper] = doorStates("minecraft:birch_door", "west", "right");
    expect(parseBlockState(lower).base).toBe("minecraft:birch_door");
    expect(parseBlockState(upper).base).toBe("minecraft:birch_door");
    expect(props(lower)).toEqual({
      facing: "west",
      half: "lower",
      hinge: "right",
      open: "false",
      powered: "false",
    });
    expect(props(upper)).toEqual({
      facing: "west",
      half: "upper",
      hinge: "right",
      open: "false",
      powered: "false",
    });

    // A non-door id falls back to oak rather than emitting an invalid block id.
    const fallback = doorStates("minecraft:stone", "north");
    expect(parseBlockState(fallback[0]).base).toBe("minecraft:oak_door");
    expect(parseBlockState(fallback[1]).base).toBe("minecraft:oak_door");
  });

  it("never writes boolean values into the three-state wall side enums", () => {
    for (const base of Object.keys(BLOCKS)) {
      const wall = wallFor(base);
      if (!wall) continue;
      for (const connected of [true, false]) {
        const stateProps = props(wallState(wall, connected));
        for (const direction of ["east", "north", "south", "west"] as const) {
          expect(["none", "tall"], `${wall}.${direction}`).toContain(stateProps[direction]);
        }
      }
    }
  });

  it("accepts every semantic helper output in Minecraft 1.21.4", () => {
    const states = [
      stairState("minecraft:cobblestone_stairs", "north"),
      slabState("minecraft:cobblestone_slab"),
      fenceState("minecraft:birch_fence"),
      wallState("minecraft:cobblestone_wall"),
      trapdoorState("minecraft:birch_trapdoor", "east"),
      lanternState(false),
      soulLanternState(true),
      ironBarsState(),
      chainState(),
      ...doorStates("minecraft:iron_door", "south"),
    ];
    expect(states.flatMap(propertyIssues)).toEqual([]);
  });
});
