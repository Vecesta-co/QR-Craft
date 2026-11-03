"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useQrCraft } from "@/state/useQrCraft";
import { CameraRig } from "@/components/viewer/CameraRig";
import { SceneAtmosphere } from "@/components/viewer/SceneAtmosphere";
import { WorldMesh } from "@/components/viewer/WorldMesh";
import { BuilderCharacter } from "@/components/viewer/BuilderCharacter";
import { ExploreController } from "@/components/viewer/ExploreController";
import { TopViewCertifier } from "@/components/viewer/TopViewCertifier";
import type { GeneratedWorldTransfer } from "@/lib/worker/protocol";
import type { SiteLayout } from "@/lib/world/site";

function Scene({ result }: { result: GeneratedWorldTransfer }) {
  return (
    <>
      <CameraRig layout={result.layout} />
      <SceneAtmosphere layout={result.layout} />
      <WorldMesh result={result} />
      <BuilderCharacter />
      <ExploreController layout={result.layout} />
      <TopViewCertifier result={result} layout={result.layout} />
    </>
  );
}

export default function WorldCanvas() {
  const result = useQrCraft((state) => state.result);
  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows={false}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      camera={{ position: [140, 120, 160], fov: 44, near: 0.4, far: 1400 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.02;
      }}
    >
      <color attach="background" args={["#d9e2dc"]} />
      {result ? <Scene result={result} /> : <CameraRig layout={DEFAULT_LAYOUT} />}
    </Canvas>
  );
}

// A neutral framing rig for the first paint before a world is generated.
const DEFAULT_LAYOUT: SiteLayout = {
  worldSize: 192,
  worldHeight: 84,
  citySize: 150,
  cityX: 21,
  cityZ: 21,
  cityRect: { x1: 21, z1: 21, x2: 170, z2: 170 },
  plateauRect: { x1: 15, z1: 15, x2: 176, z2: 176 },
  moatRect: { x1: 9, z1: 9, x2: 182, z2: 182 },
  esplanadeWidth: 6,
  moatWidth: 6,
  waterY: 16,
  plateauTopY: 19,
  cityGroundY: 20,
  bridgeY: 20,
  bridgeWidth: 8,
  spawn: { x: 96, y: 22.6, z: 186 },
  centerX: 96,
  centerZ: 96,
  qr: {
    payload: "",
    size: 1,
    moduleCount: 1,
    quietZone: 0,
    version: 1,
    errorCorrectionLevel: "M" as const,
    data: new Uint8Array(1),
  },
  cellSize: 5,
};
