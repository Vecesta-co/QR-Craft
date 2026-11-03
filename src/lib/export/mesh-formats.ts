import type { VoxelMesh } from "@/lib/export/mesh";

const HEADER_ENCODING = new TextEncoder();

/**
 * Binary little-endian PLY with per-vertex colour. PLY does not carry material
 * names, so vertex colour is the portable way to preserve the QRCraft palette.
 */
export function writePly(mesh: VoxelMesh): Uint8Array {
  const header = [
    "ply",
    "format binary_little_endian 1.0",
    "comment QRCraft visible-surface voxel export",
    "comment Coordinates: X east, Y up, Z south; centred on the origin",
    `element vertex ${mesh.vertexCount}`,
    "property float x",
    "property float y",
    "property float z",
    "property uchar red",
    "property uchar green",
    "property uchar blue",
    `element face ${mesh.faceCount}`,
    "property list uchar int vertex_indices",
    "end_header",
    "",
  ].join("\n");
  const headerBytes = HEADER_ENCODING.encode(header);
  const vertexStride = 15;
  const faceStride = 17;
  const output = new Uint8Array(
    headerBytes.length + mesh.vertexCount * vertexStride + mesh.faceCount * faceStride,
  );
  output.set(headerBytes, 0);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  let offset = headerBytes.length;
  for (let i = 0; i < mesh.vertexCount; i++) {
    view.setFloat32(offset, mesh.positions[i * 3], true);
    view.setFloat32(offset + 4, mesh.positions[i * 3 + 1], true);
    view.setFloat32(offset + 8, mesh.positions[i * 3 + 2], true);
    view.setUint8(offset + 12, Math.round(mesh.colors[i * 3] * 255));
    view.setUint8(offset + 13, Math.round(mesh.colors[i * 3 + 1] * 255));
    view.setUint8(offset + 14, Math.round(mesh.colors[i * 3 + 2] * 255));
    offset += vertexStride;
  }
  for (let i = 0; i < mesh.faceCount; i++) {
    view.setUint8(offset, 4);
    view.setInt32(offset + 1, mesh.indices[i * 6], true);
    view.setInt32(offset + 5, mesh.indices[i * 6 + 1], true);
    view.setInt32(offset + 9, mesh.indices[i * 6 + 2], true);
    view.setInt32(offset + 13, mesh.indices[i * 6 + 3], true);
    offset += faceStride;
  }
  return output;
}

/** Binary STL; geometry only. The header names the source and axis convention. */
export function writeStl(mesh: VoxelMesh): Uint8Array {
  const header = new Uint8Array(80);
  header.set(HEADER_ENCODING.encode("QRCraft binary STL - geometry only, Y up, X east, Z south"));
  const triangleCount = mesh.triangleCount;
  const output = new Uint8Array(84 + triangleCount * 50);
  output.set(header, 0);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  view.setUint32(80, triangleCount, true);
  let offset = 84;
  const triangle = (a: number, b: number, c: number) => {
    const ax = mesh.positions[a * 3];
    const ay = mesh.positions[a * 3 + 1];
    const az = mesh.positions[a * 3 + 2];
    const bx = mesh.positions[b * 3];
    const by = mesh.positions[b * 3 + 1];
    const bz = mesh.positions[b * 3 + 2];
    const cx = mesh.positions[c * 3];
    const cy = mesh.positions[c * 3 + 1];
    const cz = mesh.positions[c * 3 + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    view.setFloat32(offset + 12, ax, true);
    view.setFloat32(offset + 16, ay, true);
    view.setFloat32(offset + 20, az, true);
    view.setFloat32(offset + 24, bx, true);
    view.setFloat32(offset + 28, by, true);
    view.setFloat32(offset + 32, bz, true);
    view.setFloat32(offset + 36, cx, true);
    view.setFloat32(offset + 40, cy, true);
    view.setFloat32(offset + 44, cz, true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  };
  for (let i = 0; i < mesh.faceCount; i++) {
    const base = i * 4;
    triangle(mesh.indices[base], mesh.indices[base + 1], mesh.indices[base + 2]);
    triangle(mesh.indices[base], mesh.indices[base + 2], mesh.indices[base + 3]);
  }
  return output;
}
