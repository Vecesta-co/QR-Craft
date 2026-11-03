/**
 * First-person player physics for Explore Mode.
 *
 * This module is deliberately free of React and Three.js so the movement rules
 * can be unit tested in Node against a real VoxelWorld. The renderer only feeds
 * it input and copies the resulting pose onto the camera.
 */

export const EYE_HEIGHT = 1.62;
export const PLAYER_HEIGHT = 1.75;
export const PLAYER_RADIUS = 0.32;

const MAX_STEP = 0.05;
const MIN_STEP = 0.001;

export interface PlayerState {
  x: number;
  z: number;
  /** Y coordinate of the player's feet. */
  feet: number;
  vx: number;
  vz: number;
  vy: number;
  yaw: number;
  pitch: number;
  onGround: boolean;
}

export interface PlayerInput {
  /** +1 forward, -1 back. */
  forward: number;
  /** +1 right, -1 left. */
  strafe: number;
  jump: boolean;
  sprint: boolean;
}

export interface ExploreWorld {
  get(x: number, y: number, z: number): string;
  isSolid(x: number, y: number, z: number): boolean;
  highestSolidY(x: number, z: number): number;
}

export interface ExploreLayout {
  waterY: number;
  worldSize: number;
  spawn: { x: number; y: number; z: number };
}

export const IDLE_INPUT: PlayerInput = {
  forward: 0,
  strafe: 0,
  jump: false,
  sprint: false,
};

export function createPlayer(layout: ExploreLayout): PlayerState {
  return {
    x: layout.spawn.x,
    z: layout.spawn.z,
    feet: layout.spawn.y - EYE_HEIGHT,
    vx: 0,
    vz: 0,
    vy: 0,
    yaw: 0,
    pitch: -0.04,
    onGround: false,
  };
}

function cellsFor(x: number, z: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: Math.floor(x - PLAYER_RADIUS + 0.001),
    maxX: Math.floor(x + PLAYER_RADIUS - 0.001),
    minZ: Math.floor(z - PLAYER_RADIUS + 0.001),
    maxZ: Math.floor(z + PLAYER_RADIUS - 0.001),
  };
}

export function isInWater(world: ExploreWorld, x: number, feet: number, z: number): boolean {
  return world.get(Math.floor(x), Math.floor(feet + 0.25), Math.floor(z)) === "minecraft:water";
}

function collides(world: ExploreWorld, x: number, feet: number, z: number): boolean {
  const { minX, maxX, minZ, maxZ } = cellsFor(x, z);
  const minY = Math.floor(feet + 0.04);
  const maxY = Math.floor(feet + PLAYER_HEIGHT - 0.04);
  for (let y = minY; y <= maxY; y++) {
    for (let zz = minZ; zz <= maxZ; zz++) {
      for (let xx = minX; xx <= maxX; xx++) {
        if (world.isSolid(xx, y, zz)) return true;
      }
    }
  }
  return false;
}

export function supportHeight(world: ExploreWorld, x: number, z: number): number {
  const { minX, maxX, minZ, maxZ } = cellsFor(x, z);
  let support = 0;
  for (let zz = minZ; zz <= maxZ; zz++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const top = world.highestSolidY(xx, zz);
      if (top + 1 > support) support = top + 1;
    }
  }
  return support;
}

/** Place the player at the spawn point and snap them onto the local surface. */
export function spawnPlayer(world: ExploreWorld, layout: ExploreLayout, player: PlayerState): void {
  player.x = layout.spawn.x;
  player.z = layout.spawn.z;
  player.feet = layout.spawn.y - EYE_HEIGHT;
  player.vx = 0;
  player.vz = 0;
  player.vy = 0;
  player.yaw = 0;
  player.pitch = -0.04;
  const support = supportHeight(world, player.x, player.z);
  if (support > player.feet - 1 && support < player.feet + 1.5) player.feet = support;
  player.onGround = true;
}

function stepMove(world: ExploreWorld, player: PlayerState, dx: number, dz: number, wet: boolean): void {
  if (dx === 0 && dz === 0) return;
  const nx = player.x + dx;
  const nz = player.z + dz;
  if (!collides(world, nx, player.feet, nz)) {
    player.x = nx;
    player.z = nz;
    return;
  }
  if (player.onGround || wet) {
    // Minecraft-style one-block auto-step.
    const raised = player.feet + 1.02;
    if (!collides(world, nx, raised, nz)) {
      player.feet = raised;
      player.x = nx;
      player.z = nz;
      player.onGround = false;
    }
  }
}

/**
 * Advance the player by one frame, mutating `player` in place.
 *
 * Horizontal movement is axis-separated so sliding along walls works. Vertical
 * movement is resolved against the highest solid surface under the player's
 * footprint, with a head check while rising.
 */
export function stepPlayer(
  world: ExploreWorld,
  layout: ExploreLayout,
  player: PlayerState,
  input: PlayerInput,
  delta: number,
): void {
  const dt = Math.min(MAX_STEP, Math.max(MIN_STEP, delta));
  const wet = isInWater(world, player.x, player.feet, player.z);

  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);

  let wishX = forwardX * input.forward + rightX * input.strafe;
  let wishZ = forwardZ * input.forward + rightZ * input.strafe;
  const wishLength = Math.hypot(wishX, wishZ);
  if (wishLength > 0) {
    wishX /= wishLength;
    wishZ /= wishLength;
  }

  const speed = wet ? 3.2 : input.sprint ? 10.5 : 6.2;
  const blend = 1 - Math.exp(-14 * dt);
  player.vx += (wishX * speed - player.vx) * blend;
  player.vz += (wishZ * speed - player.vz) * blend;

  if (input.jump && (player.onGround || wet)) {
    player.vy = wet ? 4.6 : 8.4;
    player.onGround = false;
  }

  const gravity = wet ? 7.5 : 26;
  player.vy -= gravity * dt;
  if (wet && player.vy < -4) player.vy = -4;

  stepMove(world, player, player.vx * dt, 0, wet);
  stepMove(world, player, 0, player.vz * dt, wet);

  const support = supportHeight(world, player.x, player.z);
  if (player.vy <= 0) {
    const nextFeet = player.feet + player.vy * dt;
    if (nextFeet <= support) {
      player.feet = support;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.feet = nextFeet;
      player.onGround = false;
    }
  } else {
    const nextFeet = player.feet + player.vy * dt;
    const headY = Math.floor(nextFeet + PLAYER_HEIGHT);
    const { minX, maxX, minZ, maxZ } = cellsFor(player.x, player.z);
    let blocked = false;
    for (let zz = minZ; zz <= maxZ && !blocked; zz++) {
      for (let xx = minX; xx <= maxX && !blocked; xx++) {
        if (world.isSolid(xx, headY, zz)) blocked = true;
      }
    }
    if (blocked) player.vy = 0;
    else {
      player.feet = nextFeet;
      player.onGround = false;
    }
  }

  if (wet && player.feet + 0.2 < layout.waterY) {
    player.vy = Math.max(player.vy, 0.2);
    player.onGround = false;
  }

  if (
    player.feet < -2 ||
    player.x < -2 ||
    player.z < -2 ||
    player.x > layout.worldSize + 2 ||
    player.z > layout.worldSize + 2
  ) {
    player.x = layout.spawn.x;
    player.z = layout.spawn.z;
    player.feet = layout.spawn.y - EYE_HEIGHT;
    player.vy = 0;
    player.vx = 0;
    player.vz = 0;
  }
}
