# Builder System

QR Craft does not play a decorative construction animation over a finished world. The builder mutates the **same `VoxelWorld` instance** that is later certified, explored and exported. This document describes how placements become a task graph, how the engine executes it, and what the UI controls actually do.

---

## 1. From placements to tasks

Every city placement is recorded through `PlacementRecorder` with:

```ts
{ x, y, z, block, phase, group }
```

`phase` is one of the five build phases:

| Phase | Meaning |
| --- | --- |
| `ground` | City paving, roads, plaza, approach |
| `foundation` | Footings and bases |
| `walls` | Vertical structure |
| `roofs` | Roof layers and caps |
| `details` | Battlements, trim, decoration, finishing |

`group` identifies the structure or subsystem, such as `castle-keep`, `cathedral-nave`, `market-stalls`, `house-12` or `city-roads`.

`compileBuildPlan()` in `src/lib/construction/plan.ts`:

1. Records the first-seen order of each group.
2. Groups placements by `${group}|${phase}`.
3. Splits any group-phase larger than **1,200 placements** into sequential chunks.
4. Sorts tasks by **phase order**, then **group order**, then task id.
5. Computes an anchor — the centroid of the task's blocks plus 0.5 — for the builder to walk to.
6. Builds a dependency list for every task.

### Dependency rules

- A task depends on the previous phase's last task in the **same group** (foundation after ground, walls after foundation, and so on).
- Chunks within one group-phase chain in order.
- The first non-ground task of a group depends on the **last ground task of every group**, so no building starts before the complete ground pass.
- The first task of a phase in a group depends on the last task of the previous phase in **every group that has work in that phase** — a global phase gate.

The dependency graph documents and enforces the ordering used to compile the array. The engine executes the sorted array **sequentially**; it is not a parallel scheduler. This keeps world mutation frame-budgeted and easy to reason about.

Task labels are generated from group and phase, for example:

- `Paving the processional approach`
- `Setting the foundations of the High Keep`
- `Raising the roofs of rowhouse 53`
- `Finishing the Grand Cathedral`

The default 192² Kingdom (High Gothic, Detailed, Balanced, seed 1337) compiles **528 tasks** covering **90,868 placements**. The exact task count varies with site, style, quality, complexity and payload; Standard/Detailed/Showcase are genuinely different plans.

---

## 2. Construction engine

`ConstructionEngine` in `src/lib/construction/engine.ts` is a small state machine:

```text
travel → build → settle → travel → … → complete
```

- **travel** — move the builder pose toward the task anchor at `travelSpeed` (default **280 blocks/s**). The pose yaw follows the direction of travel.
- **build** — apply placements from the task at `blocksPerSecond` (default **3,600/s**) by calling `world.set(x, y, z, block)`. `appliedBlocks` increments once per placement.
- **settle** — wait **0.035 s** so the task visibly finishes before the next one starts.
- **complete** — stop, hide the movement/applying pose states, and report completion.

### Timing

- The engine is advanced by `requestAnimationFrame`; each frame's `delta` is clamped to a maximum of **0.25 s** so returning to a background tab cannot dump a huge jump into the world.
- Simulated time is multiplied by the speed multiplier.
- Each `update()` call runs at most 12 inner iterations as a safety guard.
- The default speed multiplier is **4×**. The UI offers **1×, 2×, 4× and 8×**; the engine clamps any value to 0.25–8.
- State changes are emitted immediately; progress updates are throttled to roughly one every **90 ms** unless the task label changes.

Speed changes affect how fast construction is displayed and how quickly the world reaches its final state. They never change the placement order or the final world.

### Pause, resume, cancel

- `pause()` only acts while building. It stops pose motion and placement application; the world keeps whatever has been placed.
- `resume()` continues from the exact task and block index.
- `cancel()` stops construction, hides the builder and marks the status `cancelled`. The partial world remains visible for inspection but is not offered for export, because exports require `complete`.

Pause does not freeze the renderer or the Explore controller; it only freezes the builder executor.

### Builder pose

The pose is part of the engine, not a separate animation:

- `x`, `z` follow task anchors;
- `y` is smoothed toward the top solid block at the builder's position, so the builder walks over roofs and terrain;
- `moving` and `applying` drive the procedural character's limbs and hammer;
- `visible` is false after cancellation.

`BuilderCharacter` reads this pose every frame. It is marked `userData.qrCaptureHide`, so the certification pass hides it before rendering the top view. It cannot occlude the QR.

### Emission

`onChange` publishes a `BuilderState`:

```ts
{ status, taskIndex, taskCount, taskLabel, group, phase,
  appliedBlocks, totalBlocks, progress, speed }
```

The store copies this into UI state. `progress` is `appliedBlocks / totalBlocks`.

---

## 3. Live world integration

`src/lib/client/generation-service.ts` owns the runtime lifecycle:

1. The worker returns a **bare terrain snapshot** and the compiled plan.
2. The main thread reconstructs the `VoxelWorld`.
3. A new `ConstructionEngine` starts at the south approach.
4. The previous engine, if any, is cancelled.
5. The store receives the result, world and engine; certification resets to the initial matrix/software state.
6. A `requestAnimationFrame` loop advances the engine.
7. When the engine reports `complete`, the store requests live certification.

`WorldMesh` uses the same engine count:

- every planned instance carries its placement order in `aOrder`;
- the shared `uApplied` uniform is set to `engine.applied` each frame;
- an instance with `aOrder > uApplied` collapses to a point in the vertex shader.

So the visible reveal and the voxel mutation are driven by one counter. There is no second timeline to drift out of sync.

Explore Mode reads `liveWorld` directly, which means you can walk through the city while it is still being built. Construction continues during exploration. This is intentional and is described in [exploration-mode.md](exploration-mode.md).

---

## 4. What the UI shows

The **Build** panel displays:

- current task label and status (`building`, `paused`, `complete`, `cancelled`);
- progress in blocks and percent;
- speed controls;
- pause/resume/cancel;
- the next few tasks in the window around the current index;
- the five-phase ladder with the current phase active;
- measured world statistics, including **World blocks** (all solid voxels, not just builder placements);
- the scene score with explanatory tooltips.

The stage overlay shows the same task label and progress while construction runs. It disappears on completion or cancellation.

---

## 5. Honest limits

- Construction is frame-rate dependent in wall-clock duration: a slower machine takes longer to display the same task sequence. The **order and final state** are deterministic; the exact time between frames is not.
- The engine applies placements sequentially, even though the plan records a dependency graph. There is no multithreaded construction scheduler.
- Cancelling leaves a partial world. It is visibly incomplete and cannot be exported.
- Speed only scales simulated time. It does not skip placements or interpolate the final state.
- The builder character is a simple procedural figure, not a rigged or animated third-party model.
- If the tab is backgrounded, animation frames pause; on return, the delta clamp prevents a large catch-up jump.
