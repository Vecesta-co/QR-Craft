import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { buildVoxelMesh } from "@/lib/export/mesh";
import type { VoxelWorld } from "@/lib/world/VoxelWorld";

/**
 * Binary glTF with vertex colours. GLB is the recommended interchange export:
 * it preserves geometry, normals, colour and the generator's axis convention
 * without requiring a separate material library.
 */
export async function writeGlb(world: VoxelWorld): Promise<Uint8Array> {
  const mesh = buildVoxelMesh(world);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(mesh.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    name: "QRCraft Palette",
  });
  const object = new THREE.Mesh(geometry, material);
  object.name = "QRCraft Kingdom";

  const exporter = new GLTFExporter();
  try {
    const result = await exporter.parseAsync(object, {
      binary: true,
      onlyVisible: true,
      truncateDrawRange: false,
    });
    if (!(result instanceof ArrayBuffer)) {
      throw new Error("The GLB exporter returned JSON instead of a binary glTF.");
    }
    return new Uint8Array(result);
  } finally {
    geometry.dispose();
    material.dispose();
  }
}
