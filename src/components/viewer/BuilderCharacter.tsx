"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useQrCraft } from "@/state/useQrCraft";

/**
 * A small block builder. It is driven entirely by the ConstructionEngine pose:
 * the same pose that applies placements to the live VoxelWorld. The model is
 * marked capture-hidden so it never occludes the QR top-view certification.
 */
export function BuilderCharacter() {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legLeft = useRef<THREE.Mesh>(null);
  const legRight = useRef<THREE.Mesh>(null);
  const armLeft = useRef<THREE.Mesh>(null);
  const armRight = useRef<THREE.Mesh>(null);
  const hammer = useRef<THREE.Group>(null);
  const phase = useRef(0);

  const materials = useMemo(
    () => ({
      tunic: new THREE.MeshLambertMaterial({ color: "#3f5d4c" }),
      trousers: new THREE.MeshLambertMaterial({ color: "#3b3028" }),
      skin: new THREE.MeshLambertMaterial({ color: "#c8966d" }),
      helmet: new THREE.MeshLambertMaterial({
        color: "#d8a84e",
        emissive: new THREE.Color("#6b4b18"),
        emissiveIntensity: 0.5,
      }),
      wood: new THREE.MeshLambertMaterial({ color: "#6d4f33" }),
      metal: new THREE.MeshLambertMaterial({ color: "#9ba4a1" }),
      boot: new THREE.MeshLambertMaterial({ color: "#241d18" }),
    }),
    [],
  );

  useFrame((_, delta) => {
    const engine = useQrCraft.getState().engine;
    const target = group.current;
    if (!target || !engine) return;
    const pose = engine.pose;
    target.visible = pose.visible;
    target.position.set(pose.x, pose.y, pose.z);
    target.rotation.y = pose.yaw + Math.PI;
    phase.current += delta * (pose.moving ? 10 : pose.applying ? 15 : 2.5);
    const swing = pose.moving ? Math.sin(phase.current) * 0.55 : 0;
    if (legLeft.current) legLeft.current.rotation.x = swing;
    if (legRight.current) legRight.current.rotation.x = -swing;
    if (armLeft.current) armLeft.current.rotation.x = -swing * 0.8;
    if (armRight.current) {
      armRight.current.rotation.x = pose.applying
        ? -0.7 + Math.abs(Math.sin(phase.current)) * 1.5
        : swing * 0.8;
    }
    if (hammer.current) {
      hammer.current.rotation.z = pose.applying ? Math.sin(phase.current * 2) * 0.25 - 0.25 : 0;
    }
    if (body.current) {
      body.current.position.y = pose.moving ? Math.abs(Math.sin(phase.current)) * 0.06 : 0;
    }
  });

  return (
    <group
      ref={group}
      name="builder"
      userData={{ qrCaptureHide: true }}
      scale={1.08}
      dispose={null}
    >
      <group ref={body}>
        <mesh material={materials.tunic} position={[0, 1.18, 0]}>
          <boxGeometry args={[0.58, 0.78, 0.34]} />
        </mesh>
        <mesh material={materials.trousers} position={[0, 0.68, 0]}>
          <boxGeometry args={[0.52, 0.24, 0.32]} />
        </mesh>
        <mesh material={materials.skin} position={[0, 1.78, 0]}>
          <boxGeometry args={[0.48, 0.48, 0.46]} />
        </mesh>
        <mesh material={materials.helmet} position={[0, 2.04, 0]}>
          <boxGeometry args={[0.58, 0.17, 0.54]} />
        </mesh>
        <mesh material={materials.helmet} position={[0, 1.94, 0]}>
          <boxGeometry args={[0.54, 0.07, 0.5]} />
        </mesh>
        <mesh material={materials.boot} position={[-0.15, 0.52, 0.04]} ref={legLeft}>
          <boxGeometry args={[0.2, 0.52, 0.26]} />
        </mesh>
        <mesh material={materials.boot} position={[0.15, 0.52, 0.04]} ref={legRight}>
          <boxGeometry args={[0.2, 0.52, 0.26]} />
        </mesh>
        <mesh material={materials.tunic} position={[-0.38, 1.2, 0]} ref={armLeft}>
          <boxGeometry args={[0.16, 0.68, 0.22]} />
        </mesh>
        <mesh material={materials.tunic} position={[0.38, 1.2, 0]} ref={armRight}>
          <boxGeometry args={[0.16, 0.68, 0.22]} />
        </mesh>
        <group ref={hammer} position={[0.46, 1.04, 0.08]}>
          <mesh material={materials.wood} position={[0, 0.28, 0]}>
            <boxGeometry args={[0.07, 0.7, 0.07]} />
          </mesh>
          <mesh material={materials.metal} position={[0, 0.64, 0]}>
            <boxGeometry args={[0.34, 0.16, 0.18]} />
          </mesh>
        </group>
        <pointLight color="#ffd58a" intensity={0.7} distance={3} position={[0, 1.8, 0.2]} />
      </group>
    </group>
  );
}
