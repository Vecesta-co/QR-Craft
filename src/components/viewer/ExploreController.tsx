"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { SiteLayout } from "@/lib/world/site";
import { useQrCraft } from "@/state/useQrCraft";
import { setExploreLockRequest } from "@/lib/client/explore-lock";
import {
  createPlayer,
  EYE_HEIGHT,
  spawnPlayer,
  stepPlayer,
  type PlayerInput,
  type PlayerState,
} from "@/lib/explore/physics";

/**
 * First-person controller. Input handling and pointer lock live here; all
 * collision, gravity and jumping rules live in the pure physics module so they
 * can be tested without a browser.
 */
export function ExploreController({ layout }: { layout: SiteLayout }) {
  const active = useQrCraft((state) => state.viewMode === "explore");
  const liveWorld = useQrCraft((state) => state.liveWorld);
  const { camera, gl } = useThree();
  const state = useRef<PlayerState>(createPlayer(layout));
  const keys = useRef(new Set<string>());

  useEffect(() => {
    if (!active) return;
    const world = liveWorld;
    if (!world) return;
    const player = state.current;
    const keySet = keys.current;
    spawnPlayer(world, layout, player);
    camera.up.set(0, 1, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.set(player.pitch, player.yaw, 0);
    camera.position.set(player.x, player.feet + EYE_HEIGHT, player.z);

    const requestLock = () => {
      const element = gl.domElement;
      if (document.pointerLockElement !== element) {
        void element.requestPointerLock();
      }
    };
    setExploreLockRequest(requestLock);
    const onCanvasClick = () => requestLock();
    gl.domElement.addEventListener("click", onCanvasClick);

    const onPointerLockChange = () => {
      useQrCraft.getState().setExploreLocked(document.pointerLockElement === gl.domElement);
    };
    document.addEventListener("pointerlockchange", onPointerLockChange);

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      player.yaw -= event.movementX * 0.0023;
      player.pitch -= event.movementY * 0.002;
      player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
    };
    document.addEventListener("mousemove", onMouseMove);

    const isTyping = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.code === "Escape") {
        if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
        return;
      }
      if (["Space", "ShiftLeft", "ShiftRight", "ArrowUp", "ArrowDown"].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === "KeyR") {
        spawnPlayer(world, layout, player);
        return;
      }
      keySet.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keySet.delete(event.code);
    };
    const onBlur = () => keySet.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      gl.domElement.removeEventListener("click", onCanvasClick);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      setExploreLockRequest(null);
      keySet.clear();
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      useQrCraft.getState().setExploreLocked(false);
    };
  }, [active, camera, gl, layout, liveWorld]);

  useFrame((_, delta) => {
    if (!active) return;
    const world = useQrCraft.getState().liveWorld;
    if (!world) return;
    const player = state.current;
    const keysDown = keys.current;
    const input: PlayerInput = {
      forward:
        (keysDown.has("KeyW") || keysDown.has("ArrowUp") ? 1 : 0) -
        (keysDown.has("KeyS") || keysDown.has("ArrowDown") ? 1 : 0),
      strafe:
        (keysDown.has("KeyD") || keysDown.has("ArrowRight") ? 1 : 0) -
        (keysDown.has("KeyA") || keysDown.has("ArrowLeft") ? 1 : 0),
      jump: keysDown.has("Space"),
      sprint: keysDown.has("ShiftLeft") || keysDown.has("ShiftRight"),
    };
    stepPlayer(world, layout, player, input, delta);
    camera.position.set(player.x, player.feet + EYE_HEIGHT, player.z);
    camera.rotation.order = "YXZ";
    camera.rotation.set(player.pitch, player.yaw, 0);
  });

  return null;
}
