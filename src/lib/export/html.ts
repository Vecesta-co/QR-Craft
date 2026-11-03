import { AIR, getBlock } from "@/lib/blocks/registry";
import { baseBlockId } from "@/lib/blocks/state";
import { buildTexturePixels, TEXTURE_SIZE } from "@/lib/render/textures";
import type { VoxelWorld } from "@/lib/world/VoxelWorld";
import { HTML_VIEWER_CSS, HTML_VIEWER_SCRIPT } from "@/lib/export/html-runtime";

export interface StandaloneHtmlMetadata {
  payload: string;
  seed: number;
  siteLabel: string;
  styleLabel: string;
  qualityLabel: string;
  summary: string;
  moduleCount: number;
  cellSize: number;
  buildings: number;
  structures: number;
  generatedAt?: string;
}

interface ShellGroup {
  palette: number;
  offsets: number[];
}

interface PaletteEntry {
  id: string;
  name: string;
  transparent: boolean;
  alpha: number;
  emissive: number;
}

interface ShellData {
  groups: ShellGroup[];
  palette: PaletteEntry[];
  blockCount: number;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

const TRANSPARENT_ALPHA: Record<string, number> = {
  "minecraft:water": 0.78,
  "minecraft:lava": 0.92,
  "minecraft:ice": 0.62,
  "minecraft:iron_bars": 0.6,
};

function collectShell(world: VoxelWorld): ShellData {
  const groups = new Map<string, ShellGroup>();
  const palette: PaletteEntry[] = [];
  let blockCount = 0;
  let minX = world.sizeX;
  let minY = world.sizeY;
  let minZ = world.sizeZ;
  let maxX = -1;
  let maxY = -1;
  let maxZ = -1;

  world.forEachVisibleBlock((x, y, z, id) => {
    const base = baseBlockId(id);
    if (base === AIR) return;
    const definition = getBlock(base);
    let group = groups.get(base);
    if (!group) {
      group = { palette: palette.length, offsets: [] };
      groups.set(base, group);
      palette.push({
        id: base,
        name: definition.displayName,
        transparent: Boolean(definition.transparent),
        alpha: definition.transparent ? (TRANSPARENT_ALPHA[base] ?? 0.72) : 1,
        emissive: Math.max(0, Math.min(1, definition.emissive ?? 0)),
      });
    }
    group.offsets.push(x, y, z);
    blockCount += 1;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  });

  return { groups: [...groups.values()], palette, blockCount, minX, minY, minZ, maxX, maxY, maxZ };
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to avoid the argument-count limit of String.fromCharCode and the
  // call-stack limits of spreading a whole multi-megabyte buffer.
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + chunk));
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  if (typeof btoa === "function") return btoa(binary);
  // Node fallback for unit tests and server-side tooling.
  const buffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (!buffer) throw new Error("No base64 encoder is available in this environment.");
  return buffer.from(binary, "binary").toString("base64");
}

function packOffsets(offsets: number[]): string {
  const bytes = new Uint8Array(offsets.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] < 0 || offsets[i] > 0xffff) {
      throw new Error(`World coordinate ${offsets[i]} cannot be packed into the HTML viewer.`);
    }
    view.setUint16(i * 2, offsets[i], true);
  }
  return bytesToBase64(bytes);
}

function buildAtlas(palette: PaletteEntry[]): {
  cols: number;
  rows: number;
  width: number;
  height: number;
  data: string;
} {
  const cols = Math.max(1, Math.min(16, Math.ceil(Math.sqrt(palette.length))));
  const rows = Math.ceil(palette.length / cols);
  const width = cols * TEXTURE_SIZE;
  const height = rows * TEXTURE_SIZE;
  const atlas = new Uint8Array(width * height * 4);
  palette.forEach((entry, index) => {
    const pixels = buildTexturePixels(getBlock(entry.id));
    const tileX = (index % cols) * TEXTURE_SIZE;
    const tileY = Math.floor(index / cols) * TEXTURE_SIZE;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      // WebGL's typed-array upload treats the first row as the bottom of the
      // texture. Reverse rows so v=0 samples the bottom of the source tile.
      const sourceY = TEXTURE_SIZE - 1 - y;
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const source = (sourceY * TEXTURE_SIZE + x) * 4;
        const target = ((tileY + y) * width + tileX + x) * 4;
        atlas[target] = pixels[source];
        atlas[target + 1] = pixels[source + 1];
        atlas[target + 2] = pixels[source + 2];
        atlas[target + 3] = pixels[source + 3];
      }
    }
  });
  return { cols, rows, width, height, data: bytesToBase64(atlas) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Writes a single-file interactive viewer. The data is an exposed shell (the
 * same surfaces the live viewer renders), not a full interior volume; the
 * Sponge schematic remains the lossless voxel export. Everything needed by the
 * document is embedded: exposed block offsets, an RGBA texture atlas generated
 * from QRCraft's original procedural patterns, the WebGL runtime and metadata.
 */
export function writeStandaloneHtml(
  world: VoxelWorld,
  metadata: StandaloneHtmlMetadata,
): string {
  const shell = collectShell(world);
  if (shell.blockCount === 0) throw new Error("The world has no visible blocks to export.");
  const atlas = buildAtlas(shell.palette);
  const span = Math.max(world.sizeX, world.sizeZ, 96);
  const focus = [
    (shell.minX + shell.maxX + 1) / 2,
    (shell.minY + shell.maxY) / 2,
    (shell.minZ + shell.maxZ + 1) / 2,
  ];
  const title = `${metadata.siteLabel} · ${metadata.styleLabel}`;
  const generatedAt = metadata.generatedAt ?? new Date().toISOString();
  const data = {
    version: 1,
    meta: {
      title,
      payload: metadata.payload,
      seed: metadata.seed,
      site: metadata.siteLabel,
      style: metadata.styleLabel,
      quality: metadata.qualityLabel,
      summary: metadata.summary,
      size: world.sizeX,
      height: world.sizeY,
      moduleCount: metadata.moduleCount,
      cellSize: metadata.cellSize,
      buildings: metadata.buildings,
      structures: metadata.structures,
      blockCount: shell.blockCount,
      materialCount: shell.palette.length,
      generatedAt,
    },
    world: {
      sizeX: world.sizeX,
      sizeY: world.sizeY,
      sizeZ: world.sizeZ,
      focus,
      span,
    },
    atlas,
    palette: shell.palette,
    groups: shell.groups.map((group) => ({
      palette: group.palette,
      count: group.offsets.length / 3,
      data: packOffsets(group.offsets),
    })),
  };
  const dataJson = safeJson(data);
  const script = HTML_VIEWER_SCRIPT.replace("__QR_DATA__", () => dataJson);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="generator" content="QRCraft">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="icon" href="data:,">
<title>QRCraft — ${escapeHtml(title)}</title>
<style>${HTML_VIEWER_CSS}</style>
</head>
<body>
<div id="viewer">
  <canvas id="scene" tabindex="0" aria-label="Interactive 3D view of the generated QRCraft world. Drag to orbit, scroll to zoom, right-drag or Shift-drag to pan."></canvas>
  <div class="hud">
    <header class="panel brandbar">
      <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="1.6" d="M4 4h12v12H4zM24 4h12v12H24zM4 24h12v12H4z"/>
        <path fill="currentColor" d="M24 24h5v5h-5zM31 24h5v12h-5zM24 31h5v5h-5z"/>
      </svg>
      <div class="brand-copy">
        <span class="brand-name">QRCraft</span>
        <span class="brand-tag">Standalone world viewer</span>
        <h1 id="world-title"></h1>
        <p class="subtitle" id="world-subtitle"></p>
        <span class="badge">Offline · no external requests</span>
      </div>
    </header>

    <nav class="panel controls interactive" aria-label="Camera views">
      <button type="button" class="view-button" data-view="top" aria-pressed="false">Top</button>
      <button type="button" class="view-button" data-view="front" aria-pressed="false">Front</button>
      <button type="button" class="view-button is-active" data-view="iso" aria-pressed="true">Isometric</button>
      <button type="button" class="view-button" data-view="reset" aria-pressed="false">Reset</button>
    </nav>

    <aside class="panel info interactive" aria-label="World metadata">
      <h2>World record</h2>
      <div class="meta-grid" id="meta-grid"></div>
      <p class="summary" id="summary"></p>
      <div class="stat-row" id="stats"></div>
      <h3>About this viewer</h3>
      <p class="summary">
        This single HTML file contains the exposed voxel shell, an embedded
        procedural texture atlas and its own WebGL 2 runtime. It makes no
        network requests. Interiors are omitted; use the Sponge schematic export
        for the complete voxel volume.
      </p>
      <div class="notice">
        Top, Front, Isometric and Reset are camera presets. Drag to orbit,
        scroll to zoom, and right-drag or Shift-drag to pan. Keys 1–3 and 0 also
        change the view.
      </div>
    </aside>

    <div class="hint">Orbit <b>drag</b> · Zoom <b>scroll</b> · Pan <b>right-drag / Shift-drag</b></div>
    <footer class="attribution">
      <strong>QRCraft</strong> · deterministic Minecraft-style voxel worlds · original procedural
      textures · not affiliated with, endorsed by or approved by Mojang Studios or Microsoft.
      Minecraft is a trademark of Mojang Studios. QR Code is a registered trademark of DENSO WAVE
      INCORPORATED. Generated ${escapeHtml(generatedAt)}.
    </footer>
  </div>

  <div class="loading" id="loading">
    <div class="loading-card">
      <div class="spinner" aria-hidden="true"></div>
      <p>Preparing the embedded world…</p>
    </div>
  </div>
  <div class="fallback" id="fallback" hidden></div>
  <noscript><div class="noscript">This viewer needs JavaScript and WebGL 2. The world data is embedded in the file, but it cannot be displayed without a browser runtime.</div></noscript>
</div>
<script>${script}</script>
</body>
</html>
`;
}
