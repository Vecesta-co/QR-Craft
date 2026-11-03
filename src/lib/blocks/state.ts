/**
 * Minecraft block-state identifiers.
 *
 * QRCraft stores block states as strings such as
 * `minecraft:oak_stairs[facing=east,half=bottom,shape=straight]`.
 * Structural and QR code always reasons about the base block id; renderers and
 * exports may preserve the full state string.
 */
export interface ParsedBlockState {
  base: string;
  props: Record<string, string>;
}

const STATE_PATTERN = /^([a-z0-9_]+:[a-z0-9_/]+)(?:\[([^\]]*)\])?$/;

export function parseBlockState(id: string): ParsedBlockState {
  const match = STATE_PATTERN.exec(id);
  if (!match) throw new Error(`Invalid block state id: ${id}`);
  const props: Record<string, string> = {};
  if (match[2]) {
    for (const pair of match[2].split(",")) {
      const [key, value] = pair.split("=");
      if (!key || value === undefined) throw new Error(`Invalid block state property in ${id}`);
      props[key] = value;
    }
  }
  return { base: match[1], props };
}

export function baseBlockId(id: string): string {
  const bracket = id.indexOf("[");
  return bracket < 0 ? id : id.slice(0, bracket);
}

export function blockState(
  base: string,
  props: Record<string, string | number | boolean>,
): string {
  const entries = Object.entries(props)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return base;
  return `${base}[${entries.map(([key, value]) => `${key}=${value}`).join(",")}]`;
}

export function stateProps(id: string): Record<string, string> {
  return parseBlockState(id).props;
}
