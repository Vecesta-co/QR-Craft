import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import type { BuildPlan, BuildTask } from "@/lib/world/types";

export type BuilderStatus = "idle" | "building" | "paused" | "complete" | "cancelled";

export interface BuilderState {
  status: BuilderStatus;
  taskIndex: number;
  taskCount: number;
  taskLabel: string;
  group: string;
  phase: string;
  appliedBlocks: number;
  totalBlocks: number;
  progress: number;
  speed: number;
}

export interface BuilderPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  moving: boolean;
  applying: boolean;
  visible: boolean;
}

interface EngineOptions {
  start: { x: number; y: number; z: number };
  onChange?: (state: BuilderState) => void;
  travelSpeed?: number;
  blocksPerSecond?: number;
}

const DEFAULT_TRAVEL_SPEED = 280;
const DEFAULT_BLOCKS_PER_SECOND = 3600;

/**
 * Deterministic construction executor. It mutates the same VoxelWorld instance
 * that is later used for exploration and export, applying one placement at a
 * time in build-plan order. The renderer reveals instances by the same count.
 */
export class ConstructionEngine {
  readonly world: VoxelWorld;
  readonly plan: BuildPlan;
  readonly pose: BuilderPose;
  private readonly options: Required<Pick<EngineOptions, "travelSpeed" | "blocksPerSecond">> &
    Pick<EngineOptions, "onChange">;
  private status: BuilderStatus = "idle";
  private taskIndex = 0;
  private blockIndex = 0;
  private appliedBlocks = 0;
  private speedMultiplier = 4;
  private mode: "travel" | "build" | "settle" | "complete" = "travel";
  private settleRemaining = 0;
  private appliedAccumulator = 0;
  private lastEmit = 0;
  private lastLabel = "";

  constructor(world: VoxelWorld, plan: BuildPlan, options: EngineOptions) {
    this.world = world;
    this.plan = plan;
    this.options = {
      travelSpeed: options.travelSpeed ?? DEFAULT_TRAVEL_SPEED,
      blocksPerSecond: options.blocksPerSecond ?? DEFAULT_BLOCKS_PER_SECOND,
      onChange: options.onChange,
    };
    this.pose = {
      x: options.start.x,
      y: options.start.y,
      z: options.start.z,
      yaw: 0,
      moving: false,
      applying: false,
      visible: true,
    };
    if (plan.tasks.length === 0) {
      this.status = "complete";
      this.mode = "complete";
    }
  }

  get state(): BuilderState {
    const task = this.currentTask;
    return {
      status: this.status,
      taskIndex: Math.min(this.taskIndex, this.plan.tasks.length),
      taskCount: this.plan.tasks.length,
      taskLabel: task?.label ?? (this.status === "complete" ? "The kingdom is complete" : "Preparing the site"),
      group: task?.group ?? "",
      phase: task?.phase ?? "",
      appliedBlocks: this.appliedBlocks,
      totalBlocks: this.plan.totalBlocks,
      progress: this.plan.totalBlocks === 0 ? 1 : this.appliedBlocks / this.plan.totalBlocks,
      speed: this.speedMultiplier,
    };
  }

  get applied(): number {
    return this.appliedBlocks;
  }

  get total(): number {
    return this.plan.totalBlocks;
  }

  get currentTask(): BuildTask | undefined {
    return this.plan.tasks[this.taskIndex];
  }

  start(): void {
    if (this.status === "complete" || this.status === "cancelled") return;
    this.status = "building";
    this.emit(true);
  }

  pause(): void {
    if (this.status !== "building") return;
    this.status = "paused";
    this.pose.moving = false;
    this.pose.applying = false;
    this.emit(true);
  }

  resume(): void {
    if (this.status !== "paused") return;
    this.status = "building";
    this.emit(true);
  }

  cancel(): void {
    if (this.status === "complete") return;
    this.status = "cancelled";
    this.pose.visible = false;
    this.emit(true);
  }

  setSpeed(speed: number): void {
    this.speedMultiplier = Math.max(0.25, Math.min(8, speed));
    this.emit(true);
  }

  /** Advance the simulation by a wall-clock delta in seconds. */
  update(deltaSeconds: number): void {
    if (this.status !== "building") return;
    let remaining = Math.min(0.25, Math.max(0, deltaSeconds)) * this.speedMultiplier;
    let guard = 0;
    while (remaining > 0 && guard++ < 12) {
      if (this.mode === "complete") break;
      if (this.mode === "travel") {
        const task = this.currentTask;
        if (!task) {
          this.finish();
          break;
        }
        const dx = task.anchor.x - this.pose.x;
        const dz = task.anchor.z - this.pose.z;
        const distance = Math.hypot(dx, dz);
        const step = this.options.travelSpeed * remaining;
        this.pose.moving = distance > 0.2;
        if (distance > 0.2) {
          this.pose.yaw = Math.atan2(dx, dz);
        }
        if (distance <= step || distance < 0.35) {
          this.pose.x = task.anchor.x;
          this.pose.z = task.anchor.z;
          this.mode = "build";
          this.pose.moving = false;
          this.pose.applying = true;
          this.blockIndex = 0;
          this.appliedAccumulator = 0;
        } else {
          this.pose.x += (dx / distance) * step;
          this.pose.z += (dz / distance) * step;
          remaining = 0;
        }
      } else if (this.mode === "build") {
        const task = this.currentTask;
        if (!task) {
          this.finish();
          break;
        }
        this.appliedAccumulator += remaining * this.options.blocksPerSecond;
        const toApply = Math.floor(this.appliedAccumulator);
        if (toApply <= 0) {
          this.emit(false);
          return;
        }
        const remainingBlocks = task.blocks.length - this.blockIndex;
        const count = Math.min(toApply, remainingBlocks);
        const limit = this.blockIndex + count;
        for (; this.blockIndex < limit; this.blockIndex++) {
          const block = task.blocks[this.blockIndex];
          this.world.set(block.x, block.y, block.z, block.block);
          this.appliedBlocks += 1;
        }
        this.appliedAccumulator = Math.max(0, this.appliedAccumulator - count);
        if (this.blockIndex >= task.blocks.length) {
          this.mode = "settle";
          this.settleRemaining = 0.035;
          this.pose.applying = false;
        }
        remaining = 0;
      } else if (this.mode === "settle") {
        this.settleRemaining -= remaining;
        if (this.settleRemaining <= 0) {
          this.taskIndex += 1;
          this.blockIndex = 0;
          this.appliedAccumulator = 0;
          if (this.taskIndex >= this.plan.tasks.length) {
            this.finish();
          } else {
            this.mode = "travel";
            this.pose.applying = false;
          }
        }
        remaining = 0;
      }
    }
    this.updatePoseHeight(deltaSeconds);
    this.emit(false);
  }

  private finish(): void {
    this.status = "complete";
    this.mode = "complete";
    this.pose.moving = false;
    this.pose.applying = false;
    this.emit(true);
  }

  private updatePoseHeight(deltaSeconds: number): void {
    const x = Math.round(this.pose.x);
    const z = Math.round(this.pose.z);
    const top = this.world.topBlock(x, z);
    const targetY = (top ? top.y + 1 : 20) + 0.01;
    const factor = 1 - Math.exp(-10 * Math.min(0.1, deltaSeconds));
    this.pose.y += (targetY - this.pose.y) * Math.max(0.2, factor);
  }

  private emit(force: boolean): void {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = this.state;
    if (!force && now - this.lastEmit < 90 && state.taskLabel === this.lastLabel) return;
    this.lastEmit = now;
    this.lastLabel = state.taskLabel;
    this.options.onChange?.(state);
  }
}
