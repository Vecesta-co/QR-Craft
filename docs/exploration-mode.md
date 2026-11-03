# Exploration Mode

Explore Mode lets you walk through the same voxel kingdom that the builder constructs, the certifier captures and the exporter writes. It is a first-person controller over the live `VoxelWorld`; it is not a separate level or a pre-baked camera path.

---

## 1. Entering and leaving

- Use the **Explore** tab above the viewport, or **Walk the site** in the top bar.
- Click **Enter explore mode** (or click the canvas) to request pointer lock.
- **Esc** releases the pointer without leaving the mode.
- **Leave explore** returns to Showcase.

If pointer lock is denied or unavailable, the prompt remains visible; the app does not pretend the mouse is captured.

The mode is available as soon as a generated world exists. Construction may still be running, in which case you are walking through a world that is actively changing. This is explicit in the UI: movement continues in the same voxel world you see being built.

---

## 2. Controls

| Input | Action |
| --- | --- |
| `W`, `A`, `S`, `D` | Move forward, left, back, right |
| Arrow keys | Move forward, left, back, right |
| Mouse | Look (yaw and pitch) |
| `Space` | Jump; swim upward in water |
| `Shift` | Sprint |
| `R` | Respawn at the bridge approach |
| `Esc` | Release pointer lock |
| Click canvas | Re-acquire pointer lock |

Keyboard input is ignored while focus is in an input, textarea, select or content-editable element, so typing a payload never moves the player.

---

## 3. Physics

All movement rules live in the pure module `src/lib/explore/physics.ts`. It has no React or Three.js dependency and is tested in Node against real `VoxelWorld` instances.

### Dimensions and motion

| Constant | Value |
| --- | --- |
| Eye height | 1.62 blocks |
| Player height | 1.75 blocks |
| Player radius | 0.32 blocks |
| Walk speed | 6.2 blocks/s |
| Sprint speed | 10.5 blocks/s |
| Water speed | 3.2 blocks/s |
| Jump velocity | 8.4 blocks/s |
| Water jump velocity | 4.6 blocks/s |
| Gravity | 26 blocks/s² |
| Water gravity | 7.5 blocks/s² |
| Water fall cap | −4 blocks/s |
| Frame delta clamp | 0.001–0.05 s |

Horizontal velocity is blended toward the wish direction with `1 - exp(-14 * dt)`, which gives responsive acceleration without a hard snap. Movement is normalized so diagonal input is not faster than straight input.

### Collision

- The player footprint is checked in the cells overlapping a 0.32-block radius.
- Horizontal movement is resolved **one axis at a time**, so sliding along walls works.
- A one-block auto-step (1.02 blocks) is attempted when grounded or in water, allowing the player to climb curbs, low ledges and single-block steps.
- Vertical motion checks the highest solid surface under the footprint.
- Rising into a solid block cancels upward velocity.
- A solid block at head height blocks the jump.
- Water is detected at `feet + 0.25`; it changes speed, gravity, jump height and adds buoyancy below the water surface.

### Spawning and respawn

`createSiteLayout()` defines a spawn on the southern approach at `centerX + 0.5`, `moatRect.z2 + 4.5`, with the eye at `bridgeY + 2.6`. `spawnPlayer()` snaps the feet onto the local support surface if it is within a reasonable range.

The player also resets if they fall below Y −2, leave the site bounds, or press `R`.

### Water

The moat is genuine swimmable water. The controller slows movement, applies reduced gravity, caps sinking speed, allows a shallower jump, and applies upward buoyancy when the player's feet drop below the water surface. The visual sea beyond the site is a backdrop, not part of the playable volume.

---

## 4. Rendering and camera

`ExploreController` is a React Three Fiber component inside the scene:

- on activation it sets the camera rotation order to `YXZ` and positions the camera at the player's eye;
- every frame it reads the key set, calls `stepPlayer()`, then writes the resulting pose onto the camera;
- mouse movement updates yaw and clamps pitch to ±1.45 radians;
- pointer lock is requested on canvas click and tracked in the store;
- cleanup releases pointer lock and clears pressed keys.

The same `WorldMesh` and `SceneAtmosphere` are used as in Showcase and Top-down. There is no separate exploration geometry.

The builder continues to mutate the world while you explore. Blocks placed ahead of you are real, and the reveal shader follows the same applied counter.

---

## 5. Tested behaviour

`src/tests/explore.test.ts` covers:

- spawning on the local surface;
- falling under gravity and settling;
- jumping and landing;
- stopping at a wall instead of passing through it;
- auto-stepping onto a single-block ledge;
- sprinting faster than walking;
- water detection, slower movement and shallower jump;
- reset after leaving the site;
- the collision radius staying clear of wall faces.

The Playwright acceptance test also:

- enters Explore Mode;
- acquires real pointer lock;
- verifies the crosshair;
- presses `W` and confirms the rendered screenshot changes;
- presses `Esc` and confirms the lock prompt returns;
- leaves Explore and returns to Showcase.

Those checks prove that input reaches the live controller and moves the camera, not merely that a mode toggle changed a class name.

---

## 6. Limits

- First-person only; there is no third-person toggle.
- No touch, gamepad or mobile controls.
- No inventory, mining, placing blocks or interaction beyond movement.
- No dedicated collision mesh: collision queries the voxel grid directly, which is appropriate for this block world but not a general physics engine.
- You can explore during construction, so geometry may appear or change while you move.
- Pointer lock behaviour depends on the browser and requires a user gesture; the UI handles denial honestly.
- The visual sea plane is not swimmable and has no collision.
