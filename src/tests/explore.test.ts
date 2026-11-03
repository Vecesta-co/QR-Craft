import { describe, expect, it } from "vitest";
import { VoxelWorld } from "@/lib/world/VoxelWorld";
import {
  createPlayer,
  EYE_HEIGHT,
  isInWater,
  PLAYER_RADIUS,
  spawnPlayer,
  stepPlayer,
  type ExploreLayout,
  type PlayerInput,
  type PlayerState,
} from "@/lib/explore/physics";

const WALK: PlayerInput = { forward: 1, strafe: 0, jump: false, sprint: false };
const IDLE: PlayerInput = { forward: 0, strafe: 0, jump: false, sprint: false };
const FRAME = 1 / 60;

const layout: ExploreLayout = {
  waterY: 4,
  worldSize: 32,
  spawn: { x: 8, y: 4 + EYE_HEIGHT, z: 16 },
};

function flatWorld(): VoxelWorld {
  const world = new VoxelWorld(32, 24, 32);
  world.fill(0, 0, 0, 31, 3, 31, "minecraft:stone");
  return world;
}

function run(world: VoxelWorld, player: PlayerState, input: PlayerInput, frames: number): void {
  for (let i = 0; i < frames; i++) stepPlayer(world, layout, player, input, FRAME);
}

function grounded(world: VoxelWorld): PlayerState {
  const player = createPlayer(layout);
  spawnPlayer(world, layout, player);
  return player;
}

/** Face east: forward vector becomes +X. */
function faceEast(player: PlayerState): void {
  player.yaw = -Math.PI / 2;
}

describe("explore physics", () => {
  it("spawns standing on the local surface", () => {
    const world = flatWorld();
    const player = grounded(world);
    expect(player.feet).toBe(4);
    expect(player.onGround).toBe(true);
    expect(player.x).toBe(layout.spawn.x);
    expect(player.z).toBe(layout.spawn.z);
  });

  it("falls under gravity and settles on the ground", () => {
    const world = flatWorld();
    const player = createPlayer(layout);
    player.feet = 12;
    player.onGround = false;
    run(world, player, IDLE, 240);
    expect(player.feet).toBe(4);
    expect(player.vy).toBe(0);
    expect(player.onGround).toBe(true);
  });

  it("jumps and lands back on the ground", () => {
    const world = flatWorld();
    const player = grounded(world);
    stepPlayer(world, layout, player, { ...IDLE, jump: true }, FRAME);
    expect(player.vy).toBeGreaterThan(7);
    expect(player.onGround).toBe(false);

    let peak = player.feet;
    for (let i = 0; i < 240 && !player.onGround; i++) {
      stepPlayer(world, layout, player, IDLE, FRAME);
      peak = Math.max(peak, player.feet);
    }
    expect(peak).toBeGreaterThan(5.2);
    expect(player.feet).toBe(4);
    expect(player.onGround).toBe(true);
  });

  it("stops at a wall instead of walking through it", () => {
    const world = flatWorld();
    world.fill(12, 4, 0, 12, 8, 31, "minecraft:stone");
    const player = grounded(world);
    faceEast(player);
    run(world, player, WALK, 180);

    expect(player.x).toBeLessThan(12);
    expect(player.x).toBeGreaterThan(12 - 1);
    expect(player.feet).toBe(4);
  });

  it("auto-steps onto a single-block ledge", () => {
    const world = flatWorld();
    world.fill(12, 4, 0, 14, 4, 31, "minecraft:stone");
    const player = grounded(world);
    player.x = 11.6;
    faceEast(player);
    run(world, player, WALK, 20);

    expect(player.x).toBeGreaterThan(12);
    expect(player.feet).toBe(5);
    expect(player.onGround).toBe(true);
  });

  it("sprints faster than it walks", () => {
    const world = flatWorld();
    const walker = grounded(world);
    const sprinter = grounded(world);
    faceEast(walker);
    faceEast(sprinter);
    run(world, walker, WALK, 45);
    run(world, sprinter, { ...WALK, sprint: true }, 45);

    const walked = walker.x - layout.spawn.x;
    const sprinted = sprinter.x - layout.spawn.x;
    expect(sprinted).toBeGreaterThan(walked * 1.4);
  });

  it("detects water, slows down, and uses a shallower jump", () => {
    const world = flatWorld();
    world.fill(0, 4, 0, 7, 6, 31, "minecraft:water");
    const player = grounded(world);
    player.x = 4;
    expect(isInWater(world, player.x, player.feet, player.z)).toBe(true);

    stepPlayer(world, layout, player, { ...IDLE, jump: true }, FRAME);
    expect(player.vy).toBeGreaterThan(4.2);
    expect(player.vy).toBeLessThan(4.7);

    const before = player.x;
    run(world, player, WALK, 30);
    expect(player.x - before).toBeLessThan(2.2);
  });

  it("resets a player who leaves the site", () => {
    const world = flatWorld();
    const player = grounded(world);
    player.x = -10;
    stepPlayer(world, layout, player, IDLE, FRAME);
    expect(player.x).toBe(layout.spawn.x);
    expect(player.feet).toBe(4);
  });

  it("keeps the collision radius clear of the wall face", () => {
    expect(PLAYER_RADIUS).toBeGreaterThan(0);
    expect(PLAYER_RADIUS).toBeLessThan(0.5);
  });
});
