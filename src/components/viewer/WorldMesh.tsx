"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getBlock } from "@/lib/blocks/registry";
import { getBlockTexture } from "@/lib/render/textures";
import { revealState, revealUniform } from "@/lib/render/reveal";
import { useQrCraft } from "@/state/useQrCraft";
import type { GeneratedWorldTransfer } from "@/lib/worker/protocol";

interface BlockGroup {
  paletteIndex: number;
  id: string;
  count: number;
  positions: Float32Array;
  orders: Float32Array;
}

function buildGroups(result: GeneratedWorldTransfer): BlockGroup[] {
  const { render, renderPalette } = result;
  const buckets = new Map<number, { positions: number[]; orders: number[] }>();
  for (let i = 0; i < render.count; i++) {
    const paletteIndex = render.paletteIndices[i];
    let bucket = buckets.get(paletteIndex);
    if (!bucket) {
      bucket = { positions: [], orders: [] };
      buckets.set(paletteIndex, bucket);
    }
    bucket.positions.push(
      render.positions[i * 3],
      render.positions[i * 3 + 1],
      render.positions[i * 3 + 2],
    );
    bucket.orders.push(render.orders[i]);
  }
  const groups: BlockGroup[] = [];
  for (const [paletteIndex, bucket] of buckets) {
    const id = renderPalette[paletteIndex];
    if (!id || id === "minecraft:air") continue;
    groups.push({
      paletteIndex,
      id,
      count: bucket.orders.length,
      positions: Float32Array.from(bucket.positions),
      orders: Float32Array.from(bucket.orders),
    });
  }
  groups.sort((a, b) => a.paletteIndex - b.paletteIndex);
  return groups;
}

function BlockInstances({ group }: { group: BlockGroup }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const built = useMemo(() => {
    const block = getBlock(group.id);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.setAttribute("aOrder", new THREE.InstancedBufferAttribute(group.orders, 1));
    const transparent = Boolean(block.transparent);
    const material = new THREE.MeshLambertMaterial({
      map: getBlockTexture(group.id),
      color: 0xffffff,
      transparent,
      opacity: transparent ? 0.74 : 1,
      depthWrite: !transparent,
      side: transparent ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (block.emissive) {
      material.emissive = new THREE.Color(block.color);
      material.emissiveIntensity = Math.min(0.8, block.emissive * 0.45);
    }
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uApplied = revealUniform;
      shader.vertexShader =
        "attribute float aOrder;\nuniform float uApplied;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nif (aOrder > uApplied) { transformed = vec3(0.0); }",
      );
    };
    material.customProgramCacheKey = () => "qrcraft-instanced-reveal-v1";
    return { geometry, material };
  }, [group]);

  useEffect(() => {
    return () => {
      built.geometry.dispose();
      built.material.dispose();
    };
  }, [built]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < group.count; i++) {
      matrix.makeTranslation(
        group.positions[i * 3] + 0.5,
        group.positions[i * 3 + 1] + 0.5,
        group.positions[i * 3 + 2] + 0.5,
      );
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [group]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[built.geometry, built.material, group.count]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

export function WorldMesh({ result }: { result: GeneratedWorldTransfer }) {
  const groups = useMemo(() => buildGroups(result), [result]);

  useFrame(() => {
    const engine = useQrCraft.getState().engine;
    if (engine) {
      revealState.applied = engine.applied;
      revealUniform.value = engine.applied;
    }
  });

  return (
    <group name="qrcraft-world">
      {groups.map((group) => (
        <BlockInstances key={group.paletteIndex} group={group} />
      ))}
    </group>
  );
}
