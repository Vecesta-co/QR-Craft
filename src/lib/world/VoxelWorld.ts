import { AIR, getBlock, isOpaque } from "@/lib/blocks/registry";

export interface BlockPosition {
  x: number;
  y: number;
  z: number;
}

export interface TopBlock extends BlockPosition {
  id: string;
}

export interface WorldSnapshot {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  palette: string[];
  blocks: Uint16Array;
}

/**
 * Dense voxel world. Index order is YZX, matching the Sponge schematic data
 * order: index = (y * sizeZ + z) * sizeX + x.
 *
 * X increases east, Y increases up, Z increases south. The top row of the QR
 * is therefore at the lowest Z coordinate.
 */
export class VoxelWorld {
  readonly sizeX: number;
  readonly sizeY: number;
  readonly sizeZ: number;
  readonly blocks: Uint16Array;
  readonly palette: string[];
  private readonly paletteIndex: Map<string, number>;

  constructor(sizeX: number, sizeY: number, sizeZ: number, blocks?: Uint16Array, palette?: string[]) {
    if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) {
      throw new Error("World dimensions must be positive.");
    }
    this.sizeX = sizeX;
    this.sizeY = sizeY;
    this.sizeZ = sizeZ;
    this.blocks = blocks ?? new Uint16Array(sizeX * sizeY * sizeZ);
    if (this.blocks.length !== sizeX * sizeY * sizeZ) {
      throw new Error("Block array does not match world dimensions.");
    }
    this.palette = palette ? [...palette] : [AIR];
    if (this.palette[0] !== AIR) {
      throw new Error("World palette entry 0 must be air.");
    }
    this.paletteIndex = new Map(this.palette.map((id, index) => [id, index]));
    for (let i = 0; i < this.blocks.length; i++) {
      const id = this.palette[this.blocks[i]];
      if (id === undefined) {
        throw new Error(`World contains palette index ${this.blocks[i]} without a palette entry.`);
      }
    }
  }

  static fromSnapshot(snapshot: WorldSnapshot): VoxelWorld {
    return new VoxelWorld(
      snapshot.sizeX,
      snapshot.sizeY,
      snapshot.sizeZ,
      new Uint16Array(snapshot.blocks),
      snapshot.palette,
    );
  }

  /** Adopt a transferred snapshot without copying its block buffer. */
  static fromOwnedSnapshot(snapshot: WorldSnapshot): VoxelWorld {
    return new VoxelWorld(
      snapshot.sizeX,
      snapshot.sizeY,
      snapshot.sizeZ,
      snapshot.blocks,
      snapshot.palette,
    );
  }

  index(x: number, y: number, z: number): number {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sizeX && y < this.sizeY && z < this.sizeZ;
  }

  idForIndex(index: number): string {
    return this.palette[index] ?? AIR;
  }

  paletteFor(id: string): number {
    let index = this.paletteIndex.get(id);
    if (index === undefined) {
      index = this.palette.length;
      if (index > 65535) throw new Error("Block palette is too large.");
      this.palette.push(id);
      this.paletteIndex.set(id, index);
    }
    return index;
  }

  set(x: number, y: number, z: number, id: string): void {
    if (!this.inBounds(x, y, z)) return;
    const index = id === AIR ? 0 : this.paletteFor(id);
    this.blocks[this.index(x, y, z)] = index;
  }

  setIndex(x: number, y: number, z: number, paletteIndex: number): void {
    if (!this.inBounds(x, y, z)) return;
    if (this.palette[paletteIndex] === undefined) {
      throw new Error(`Unknown palette index ${paletteIndex}.`);
    }
    this.blocks[this.index(x, y, z)] = paletteIndex;
  }

  get(x: number, y: number, z: number): string {
    if (!this.inBounds(x, y, z)) return AIR;
    return this.palette[this.blocks[this.index(x, y, z)]] ?? AIR;
  }

  getIndex(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.blocks[this.index(x, y, z)];
  }

  isAir(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) === AIR;
  }

  isSolid(x: number, y: number, z: number): boolean {
    const id = this.get(x, y, z);
    return id !== AIR && getBlock(id).solid;
  }

  fill(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, id: string): void {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);
    const index = id === AIR ? 0 : this.paletteFor(id);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        let cursor = this.index(minX, y, z);
        for (let x = minX; x <= maxX; x++) {
          this.blocks[cursor++] = index;
        }
      }
    }
  }

  topBlock(x: number, z: number, includeNonSolid = true): TopBlock | null {
    if (x < 0 || z < 0 || x >= this.sizeX || z >= this.sizeZ) return null;
    for (let y = this.sizeY - 1; y >= 0; y--) {
      const id = this.get(x, y, z);
      if (id === AIR) continue;
      if (!includeNonSolid && !getBlock(id).solid) continue;
      return { x, y, z, id };
    }
    return null;
  }

  highestSolidY(x: number, z: number): number {
    for (let y = this.sizeY - 1; y >= 0; y--) {
      if (this.isSolid(x, y, z)) return y;
    }
    return -1;
  }

  /** A block is visible when at least one neighbour does not fully hide it. */
  isExposed(x: number, y: number, z: number): boolean {
    const id = this.get(x, y, z);
    if (id === AIR) return false;
    if (!this.inBounds(x - 1, y, z) || !isOpaque(this.get(x - 1, y, z))) return true;
    if (!this.inBounds(x + 1, y, z) || !isOpaque(this.get(x + 1, y, z))) return true;
    if (!this.inBounds(x, y - 1, z) || !isOpaque(this.get(x, y - 1, z))) return true;
    if (!this.inBounds(x, y + 1, z) || !isOpaque(this.get(x, y + 1, z))) return true;
    if (!this.inBounds(x, y, z - 1) || !isOpaque(this.get(x, y, z - 1))) return true;
    if (!this.inBounds(x, y, z + 1) || !isOpaque(this.get(x, y, z + 1))) return true;
    return false;
  }

  countBlocks(): number {
    let count = 0;
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i] !== 0) count++;
    }
    return count;
  }

  countVisibleBlocks(): number {
    let count = 0;
    for (let y = 0; y < this.sizeY; y++) {
      for (let z = 0; z < this.sizeZ; z++) {
        for (let x = 0; x < this.sizeX; x++) {
          if (this.isExposed(x, y, z)) count++;
        }
      }
    }
    return count;
  }

  clone(): VoxelWorld {
    return new VoxelWorld(
      this.sizeX,
      this.sizeY,
      this.sizeZ,
      new Uint16Array(this.blocks),
      this.palette,
    );
  }

  snapshot(): WorldSnapshot {
    return {
      sizeX: this.sizeX,
      sizeY: this.sizeY,
      sizeZ: this.sizeZ,
      palette: [...this.palette],
      blocks: new Uint16Array(this.blocks),
    };
  }

  forEachBlock(callback: (x: number, y: number, z: number, id: string) => void): void {
    for (let y = 0; y < this.sizeY; y++) {
      for (let z = 0; z < this.sizeZ; z++) {
        const rowStart = this.index(0, y, z);
        for (let x = 0; x < this.sizeX; x++) {
          const paletteIndex = this.blocks[rowStart + x];
          if (paletteIndex !== 0) {
            callback(x, y, z, this.palette[paletteIndex]);
          }
        }
      }
    }
  }

  forEachVisibleBlock(callback: (x: number, y: number, z: number, id: string) => void): void {
    for (let y = 0; y < this.sizeY; y++) {
      for (let z = 0; z < this.sizeZ; z++) {
        for (let x = 0; x < this.sizeX; x++) {
          if (this.isExposed(x, y, z)) {
            callback(x, y, z, this.get(x, y, z));
          }
        }
      }
    }
  }

  contentHash(): string {
    let hash = 2166136261;
    for (let i = 0; i < this.blocks.length; i++) {
      hash ^= this.blocks[i];
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}
