import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import { writeGlb } from "@/lib/export/glb";
import { writePly, writeStl } from "@/lib/export/mesh-formats";
import { buildVoxelMesh } from "@/lib/export/mesh";
import { writeSchematicGzip } from "@/lib/export/schematic";
import { writeStandaloneHtml } from "@/lib/export/html";
import { downloadBlob } from "@/lib/client/download";

export type ExportFormat = "glb" | "ply" | "stl" | "schem" | "html";

export interface ExportDefinition {
  id: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
  includes: string;
}

/**
 * Only formats with a working writer and a passing test are advertised. GLB and
 * PLY preserve colour; STL is geometry only; Sponge v3 preserves the full voxel
 * volume including air, water and every palette entry; HTML is a single-file
 * offline viewer of the exposed voxel shell.
 */
export const EXPORT_FORMATS: ExportDefinition[] = [
  {
    id: "glb",
    label: "GLB",
    extension: "glb",
    mimeType: "model/gltf-binary",
    description: "Coloured surface mesh for Blender, Windows 3D Viewer, Three.js and game engines.",
    includes: "Geometry, normals, vertex colours",
  },
  {
    id: "ply",
    label: "PLY",
    extension: "ply",
    mimeType: "application/octet-stream",
    description: "Binary coloured mesh with a documented vertex format. Opens in MeshLab and Blender.",
    includes: "Geometry, normals, per-vertex RGB",
  },
  {
    id: "stl",
    label: "STL",
    extension: "stl",
    mimeType: "model/stl",
    description: "Binary triangulated surface for CAD and 3D printing. Geometry only, no colours.",
    includes: "Geometry, triangle normals",
  },
  {
    id: "schem",
    label: "Sponge schematic",
    extension: "schem",
    mimeType: "application/gzip",
    description: "Full voxel volume for WorldEdit and Sponge. Gzipped Sponge Schematic v3.",
    includes: "Every block, air, water, palette, metadata",
  },
  {
    id: "html",
    label: "Interactive HTML",
    extension: "html",
    mimeType: "text/html;charset=utf-8",
    description:
      "One self-contained file with an offline 3D viewer. Opens directly from disk, no server needed.",
    includes: "Exposed shell, textures, orbit/zoom/pan camera, metadata",
  },
];

export interface ExportRequest {
  world: VoxelWorld;
  seed: number;
  payload: string;
  summary: string;
  /** Optional display metadata used by the standalone HTML viewer. */
  siteLabel?: string;
  styleLabel?: string;
  qualityLabel?: string;
  moduleCount?: number;
  cellSize?: number;
  buildings?: number;
  structures?: number;
  generatedAt?: string;
}

export interface ExportOutcome {
  filename: string;
  bytes: number;
  durationMs: number;
  format: ExportFormat;
}

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function exportFilename(format: ExportFormat, request: ExportRequest): string {
  const definition = EXPORT_FORMATS.find((item) => item.id === format);
  if (!definition) throw new Error(`Unknown export format ${format}.`);
  const slug = safeSlug(request.payload) || "qr";
  return `qrcraft-${slug}-${request.seed}.${definition.extension}`;
}

export async function exportWorld(format: ExportFormat, request: ExportRequest): Promise<ExportOutcome> {
  const started = performance.now();
  const definition = EXPORT_FORMATS.find((item) => item.id === format);
  if (!definition) throw new Error(`Unknown export format ${format}.`);
  // Yield once so the UI can paint its progress state before heavy work.
  await new Promise((resolve) => setTimeout(resolve, 16));
  let bytes: Uint8Array;
  if (format === "glb") {
    bytes = await writeGlb(request.world);
  } else if (format === "ply") {
    bytes = writePly(buildVoxelMesh(request.world));
  } else if (format === "stl") {
    bytes = writeStl(buildVoxelMesh(request.world));
  } else if (format === "html") {
    const html = writeStandaloneHtml(request.world, {
      payload: request.payload,
      seed: request.seed,
      siteLabel: request.siteLabel ?? "QRCraft world",
      styleLabel: request.styleLabel ?? "Custom architecture",
      qualityLabel: request.qualityLabel ?? "Detailed",
      summary: request.summary,
      moduleCount: request.moduleCount ?? 0,
      cellSize: request.cellSize ?? 0,
      buildings: request.buildings ?? 0,
      structures: request.structures ?? 0,
      generatedAt: request.generatedAt,
    });
    bytes = new TextEncoder().encode(html);
  } else {
    bytes = await writeSchematicGzip(request.world, {
      name: `QRCraft ${request.seed}`,
      author: "QRCraft",
      description: request.summary,
      seed: request.seed,
      payload: request.payload,
      site: request.siteLabel ?? "QRCraft world",
      style: request.styleLabel ?? "Custom architecture",
      quality: request.qualityLabel ?? "Detailed",
    });
  }
  const filename = exportFilename(format, request);
  downloadBlob(new Blob([bytes as BlobPart], { type: definition.mimeType }), filename);
  return {
    filename,
    bytes: bytes.byteLength,
    durationMs: Math.round(performance.now() - started),
    format,
  };
}
