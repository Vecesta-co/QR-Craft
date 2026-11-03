import { NbtWriter, encodeVarint } from "@/lib/export/nbt";
import { AIR } from "@/lib/blocks/registry";
import type { VoxelWorld } from "@/lib/world/VoxelWorld";

export interface SchematicMetadata {
  name: string;
  author: string;
  description: string;
  seed: number;
  payload: string;
  site?: string;
  style?: string;
  quality?: string;
  createdAt?: number;
}

export const SPONGE_DATA_VERSION = 4189;

/**
 * Sponge Schematic v3 (`.schem`), uncompressed NBT. Layout follows the public
 * specification at SpongePowered/Schematic-Specification/versions/schematic-3.md:
 * a root compound containing `Schematic`, whose `Blocks` container holds the
 * palette and YZX varint block data.
 */
export function writeSchematic(world: VoxelWorld, metadata: SchematicMetadata): Uint8Array {
  const palette: string[] = [];
  const paletteIndex = new Map<string, number>();
  for (const id of world.palette) {
    if (paletteIndex.has(id)) continue;
    paletteIndex.set(id, palette.length);
    palette.push(id);
  }
  if (palette[0] !== AIR) throw new Error("Schematic palette must start with minecraft:air.");
  const remap = new Uint16Array(world.palette.length);
  world.palette.forEach((id, index) => {
    remap[index] = paletteIndex.get(id) ?? 0;
  });

  // The curated registry has fewer than 128 entries, so every varint is one
  // byte. Keep the general encoder for larger/imported palettes.
  let data: Uint8Array;
  if (palette.length < 128) {
    data = new Uint8Array(world.blocks.length);
    for (let i = 0; i < world.blocks.length; i++) {
      data[i] = remap[world.blocks[i]];
    }
  } else {
    const encoded: number[] = [];
    for (let i = 0; i < world.blocks.length; i++) {
      encodeVarint(remap[world.blocks[i]], encoded);
    }
    data = Uint8Array.from(encoded);
  }

  const writer = new NbtWriter();
  writer.rootCompound("", () => {
    writer.compound("Schematic", () => {
      writer.namedInt("Version", 3);
      writer.namedInt("DataVersion", SPONGE_DATA_VERSION);
      writer.compound("Metadata", () => {
        writer.namedString("Name", metadata.name);
        writer.namedString("Author", metadata.author);
        writer.namedString("Description", metadata.description);
        writer.namedLong("Date", metadata.createdAt ?? Date.now());
        writer.namedString("QRCraftSeed", String(metadata.seed));
        writer.namedString("QRCraftPayload", metadata.payload);
        if (metadata.site) writer.namedString("QRCraftSite", metadata.site);
        if (metadata.style) writer.namedString("QRCraftStyle", metadata.style);
        if (metadata.quality) writer.namedString("QRCraftQuality", metadata.quality);
      });
      writer.namedShort("Width", world.sizeX);
      writer.namedShort("Height", world.sizeY);
      writer.namedShort("Length", world.sizeZ);
      writer.namedIntArray("Offset", [0, 0, 0]);
      writer.compound("Blocks", () => {
        writer.compound("Palette", () => {
          palette.forEach((id, index) => {
            writer.namedInt(id, index);
          });
        });
        writer.namedInt("PaletteMax", palette.length);
        writer.namedByteArray("Data", data);
        writer.compoundList("BlockEntities", 0, () => {});
      });
      writer.compoundList("Entities", 0, () => {});
    });
  });
  return writer.toUint8Array();
}

/** Gzip using the runtime's CompressionStream (browsers and modern Node). */
export async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    throw new Error("This browser does not support gzip compression (CompressionStream).");
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function writeSchematicGzip(
  world: VoxelWorld,
  metadata: SchematicMetadata,
): Promise<Uint8Array> {
  return gzipBytes(writeSchematic(world, metadata));
}
