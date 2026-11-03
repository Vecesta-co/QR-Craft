"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { SiteLayout } from "@/lib/world/site";

const skyVertex = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec3 top = vec3(0.42, 0.62, 0.78);
    vec3 horizon = vec3(0.88, 0.88, 0.79);
    vec3 bottom = vec3(0.72, 0.76, 0.68);
    vec3 dir = normalize(vWorldPosition);
    float h = dir.y;
    vec3 color = h > 0.0 ? mix(horizon, top, pow(h, 0.72)) : mix(horizon, bottom, pow(-h, 0.5));
    vec3 sunDir = normalize(vec3(0.42, 0.55, -0.72));
    float sun = pow(max(dot(dir, sunDir), 0.0), 420.0);
    color += vec3(1.0, 0.86, 0.58) * sun * 0.55;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function SceneAtmosphere({ layout }: { layout: SiteLayout }) {
  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  return (
    <>
      <fog attach="fog" args={["#d7dbc9", 380, 1150]} />
      <mesh
        name="sky"
        userData={{ qrCaptureHide: true }}
        material={skyMaterial}
        position={[layout.centerX, 40, layout.centerZ]}
        renderOrder={-10}
      >
        <sphereGeometry args={[580, 32, 20]} />
      </mesh>

      <hemisphereLight args={["#eaf2ef", "#5d6756", 1.25]} />
      <ambientLight intensity={0.44} color="#e9e2cf" />
      <directionalLight
        position={[layout.centerX + 130, 178, layout.centerZ - 115]}
        intensity={2.2}
        color="#fff1d5"
      />
      <directionalLight
        position={[layout.centerX - 120, 70, layout.centerZ + 150]}
        intensity={0.48}
        color="#9fbdc8"
      />

      {/* Surrounding sea, below the world's water table. */}
      <mesh
        name="sea"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[layout.centerX, layout.waterY - 0.35, layout.centerZ]}
        receiveShadow={false}
      >
        <planeGeometry args={[1800, 1800]} />
        <meshLambertMaterial color="#2f5b6b" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </>
  );
}
