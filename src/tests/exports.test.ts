import { gzipSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import nbt from "prismarine-nbt";
import { createQrMatrix } from "@/lib/qr/matrix";
import { generateWorld } from "@/lib/world/generate";
import { buildVoxelMesh } from "@/lib/export/mesh";
import { writePly, writeStl } from "@/lib/export/mesh-formats";
import { writeSchematic, SPONGE_DATA_VERSION } from "@/lib/export/schematic";

const qr = createQrMatrix("https://example.com/qrcraft", {
  errorCorrectionLevel: "M",
  quietZone: 4,
});
const generated = generateWorld({
  qr,
  seed: 1337,
  size: 128,
  style: "gothic",
  complexity: "serene",
});
const world = generated.finalWorld;

describe("surface mesh exports", () => {
  const mesh = buildVoxelMesh(world);

  it("builds only exposed faces with finite geometry", () => {
    expect(mesh.faceCount).toBeGreaterThan(1000);
    expect(mesh.vertexCount).toBe(mesh.faceCount * 4);
    expect(mesh.indices.length).toBe(mesh.faceCount * 6);
    let finite = true;
    for (let i = 0; i < mesh.positions.length; i++) {
      if (!Number.isFinite(mesh.positions[i])) finite = false;
    }
    expect(finite).toBe(true);
    let indicesValid = true;
    for (let i = 0; i < mesh.indices.length; i++) {
      if (mesh.indices[i] < 0 || mesh.indices[i] >= mesh.vertexCount) indicesValid = false;
    }
    expect(indicesValid).toBe(true);
    expect(mesh.bounds.max[1]).toBeGreaterThan(mesh.bounds.min[1]);
  });

  it("writes a binary PLY with matching element counts", () => {
    const ply = writePly(mesh);
    const headerText = new TextDecoder().decode(ply.subarray(0, 512));
    expect(headerText.startsWith("ply\nformat binary_little_endian 1.0")).toBe(true);
    expect(headerText).toContain(`element vertex ${mesh.vertexCount}`);
    expect(headerText).toContain(`element face ${mesh.faceCount}`);
    const headerEnd = headerText.indexOf("end_header\n") + "end_header\n".length;
    expect(ply.byteLength).toBe(headerEnd + mesh.vertexCount * 15 + mesh.faceCount * 17);
  });

  it("writes binary STL with the exact triangle count", () => {
    const stl = writeStl(mesh);
    const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
    expect(stl.byteLength).toBe(84 + mesh.triangleCount * 50);
    expect(view.getUint32(80, true)).toBe(mesh.triangleCount);
    expect(new TextDecoder().decode(stl.subarray(0, 40))).toContain("QRCraft binary STL");
  });
});

describe("Sponge schematic v3 export", () => {
  it("writes a valid gzipped v3 schematic with YZX data", async () => {
    const raw = writeSchematic(world, {
      name: "Test Kingdom",
      author: "QRCraft",
      description: "Export test",
      seed: 1337,
      payload: "https://example.com/qrcraft",
      site: "Kingdom",
      style: "High Gothic",
      quality: "Detailed",
      createdAt: 1_700_000_000_000,
    });
    const compressed = gzipSync(raw);
    expect(compressed[0]).toBe(0x1f);
    expect(compressed[1]).toBe(0x8b);
    expect(gunzipSync(compressed).byteLength).toBe(raw.byteLength);

    const parsed = await nbt.parse(compressed);
    const root = nbt.simplify(parsed.parsed) as unknown as Record<string, Record<string, unknown>>;
    const schematic = root.Schematic;
    expect(schematic.Version).toBe(3);
    expect(schematic.DataVersion).toBe(SPONGE_DATA_VERSION);
    expect(schematic.Width).toBe(world.sizeX);
    expect(schematic.Height).toBe(world.sizeY);
    expect(schematic.Length).toBe(world.sizeZ);
    const metadata = schematic.Metadata as Record<string, unknown>;
    expect(metadata.Name).toBe("Test Kingdom");
    expect(metadata.QRCraftSeed).toBe("1337");
    expect(metadata.QRCraftPayload).toBe("https://example.com/qrcraft");
    expect(metadata.QRCraftSite).toBe("Kingdom");
    expect(metadata.QRCraftStyle).toBe("High Gothic");
    expect(metadata.QRCraftQuality).toBe("Detailed");

    const blocks = schematic.Blocks as Record<string, unknown>;
    const palette = blocks.Palette as Record<string, number>;
    expect(palette["minecraft:air"]).toBe(0);
    expect(blocks.PaletteMax).toBe(world.palette.length);
    const data = blocks.Data as number[];
    expect(data.length).toBe(world.blocks.length);
    // Full volume is present, including the lowest and highest block.
    expect(data.length).toBe(world.sizeX * world.sizeY * world.sizeZ);
    expect(data[0]).toBe(world.blocks[0]);
    expect(data[data.length - 1]).toBe(world.blocks[world.blocks.length - 1]);
  });
});
