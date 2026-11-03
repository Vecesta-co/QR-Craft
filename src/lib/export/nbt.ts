const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_LONG = 4;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;

export { TAG_BYTE, TAG_COMPOUND, TAG_INT, TAG_LIST, TAG_LONG, TAG_SHORT, TAG_STRING };

const encoder = new TextEncoder();

/** Growable big-endian binary writer for Java Edition NBT. */
export class NbtWriter {
  private buffer = new Uint8Array(1024 * 64);
  private length = 0;
  private view = new DataView(this.buffer.buffer);

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.length) return;
    let capacity = this.buffer.length * 2;
    while (capacity < this.length + extra) capacity *= 2;
    const next = new Uint8Array(capacity);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
    this.view = new DataView(next.buffer);
  }

  private u8(value: number): void {
    this.ensure(1);
    this.buffer[this.length++] = value & 0xff;
  }

  byte(value: number): void {
    this.u8(value);
  }

  boolean(value: boolean): void {
    this.u8(value ? 1 : 0);
  }

  short(value: number): void {
    this.ensure(2);
    this.view.setInt16(this.length, value, false);
    this.length += 2;
  }

  int(value: number): void {
    this.ensure(4);
    this.view.setInt32(this.length, value, false);
    this.length += 4;
  }

  long(value: bigint | number): void {
    this.ensure(8);
    this.view.setBigInt64(this.length, BigInt(value), false);
    this.length += 8;
  }

  float(value: number): void {
    this.ensure(4);
    this.view.setFloat32(this.length, value, false);
    this.length += 4;
  }

  double(value: number): void {
    this.ensure(8);
    this.view.setFloat64(this.length, value, false);
    this.length += 8;
  }

  string(value: string): void {
    const bytes = encoder.encode(value);
    if (bytes.length > 65535) throw new Error("NBT string is longer than 65535 bytes.");
    this.short(bytes.length);
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.length);
    this.length += bytes.length;
  }

  byteArray(value: Uint8Array): void {
    this.int(value.length);
    this.ensure(value.length);
    this.buffer.set(value, this.length);
    this.length += value.length;
  }

  intArray(value: number[]): void {
    this.int(value.length);
    for (const item of value) this.int(item);
  }

  longArray(value: Array<bigint | number>): void {
    this.int(value.length);
    for (const item of value) this.long(item);
  }

  private tagName(type: number, name: string): void {
    this.u8(type);
    this.string(name);
  }

  namedByte(name: string, value: number): void {
    this.tagName(TAG_BYTE, name);
    this.byte(value);
  }

  namedShort(name: string, value: number): void {
    this.tagName(TAG_SHORT, name);
    this.short(value);
  }

  namedInt(name: string, value: number): void {
    this.tagName(TAG_INT, name);
    this.int(value);
  }

  namedLong(name: string, value: bigint | number): void {
    this.tagName(TAG_LONG, name);
    this.long(value);
  }

  namedString(name: string, value: string): void {
    this.tagName(TAG_STRING, name);
    this.string(value);
  }

  namedByteArray(name: string, value: Uint8Array): void {
    this.tagName(TAG_BYTE_ARRAY, name);
    this.byteArray(value);
  }

  namedIntArray(name: string, value: number[]): void {
    this.tagName(TAG_INT_ARRAY, name);
    this.intArray(value);
  }

  /** Start a named compound. Call `endCompound` after writing its children. */
  startCompound(name: string): void {
    this.tagName(TAG_COMPOUND, name);
  }

  endCompound(): void {
    this.u8(TAG_END);
  }

  /** A named compound whose children are written by the callback. */
  compound(name: string, write: () => void): void {
    this.startCompound(name);
    write();
    this.endCompound();
  }

  /** Named list of compounds. Empty lists use the end tag as element type. */
  compoundList(name: string, count: number, write: (index: number) => void): void {
    this.tagName(TAG_LIST, name);
    this.u8(count === 0 ? TAG_END : TAG_COMPOUND);
    this.int(count);
    for (let i = 0; i < count; i++) write(i);
  }

  rootCompound(name: string, write: () => void): void {
    this.tagName(TAG_COMPOUND, name);
    write();
    this.endCompound();
  }

  toUint8Array(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }

  get byteLength(): number {
    return this.length;
  }
}

/** Unsigned LEB128 used by Sponge schematic block data. */
export function encodeVarint(value: number, target: number[]): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Varint values must be non-negative integers, received ${value}.`);
  }
  let remaining = value;
  while (remaining >= 0x80) {
    target.push((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  target.push(remaining);
}
