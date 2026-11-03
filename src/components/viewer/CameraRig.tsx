"use client";

import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/world/site";
import { useQrCraft } from "@/state/useQrCraft";

export function CameraRig({ layout }: { layout: SiteLayout }) {
  const mode = useQrCraft((state) => state.viewMode);
  const preset = useQrCraft((state) => state.cameraPreset);
  const nonce = useQrCraft((state) => state.cameraPresetNonce);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const perspectiveRef = useRef<THREE.PerspectiveCamera>(null);
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();

  const target = useMemo(
    () => new THREE.Vector3(layout.centerX, layout.cityGroundY + 14, layout.centerZ),
    [layout],
  );
  const span = Math.max(layout.citySize, 120);

  const showcasePosition = useMemo(() => {
    if (preset === "front") {
      return new THREE.Vector3(target.x, target.y + span * 0.32, target.z + span * 1.16);
    }
    if (preset === "side") {
      return new THREE.Vector3(target.x + span * 1.16, target.y + span * 0.36, target.z);
    }
    return new THREE.Vector3(
      target.x + span * 0.72,
      target.y + span * 0.64,
      target.z + span * 0.78,
    );
  }, [preset, span, target]);

  useEffect(() => {
    if (mode !== "showcase") return;
    const camera = perspectiveRef.current;
    if (!camera) return;
    camera.position.copy(showcasePosition);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
  }, [mode, showcasePosition, target, nonce]);

  useEffect(() => {
    if (mode !== "top") return;
    const camera = orthoRef.current;
    if (!camera) return;
    const aspect = size.width / Math.max(1, size.height);
    const view = layout.citySize + layout.esplanadeWidth * 2 + layout.moatWidth + 6;
    const viewWidth = view * Math.max(1, aspect);
    const viewHeight = view * Math.max(1, 1 / aspect);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.near = 0.5;
    camera.far = 700;
    camera.zoom = 1;
    camera.position.set(layout.centerX, 320, layout.centerZ);
    camera.up.set(0, 0, -1);
    camera.lookAt(layout.centerX, 0, layout.centerZ);
    camera.updateProjectionMatrix();
  }, [mode, size.width, size.height, layout]);

  return (
    <>
      <PerspectiveCamera
        ref={perspectiveRef}
        makeDefault={mode !== "top"}
        fov={44}
        near={0.4}
        far={1400}
        position={[showcasePosition.x, showcasePosition.y, showcasePosition.z]}
      />
      <OrthographicCamera
        ref={orthoRef}
        makeDefault={mode === "top"}
        position={[layout.centerX, 320, layout.centerZ]}
        near={0.5}
        far={700}
        zoom={1}
      />
      {mode === "showcase" && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.075}
          minDistance={30}
          maxDistance={560}
          maxPolarAngle={Math.PI / 2 - 0.035}
          minPolarAngle={0.12}
          target={[target.x, target.y, target.z]}
        />
      )}
    </>
  );
}
