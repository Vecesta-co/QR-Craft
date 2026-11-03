/**
 * Standalone viewer runtime and stylesheet.
 *
 * This code is embedded verbatim inside the exported HTML file. It deliberately
 * has no imports, CDN links, workers, fetches or module loading: the exported
 * document must work from a plain `file://` URL with the network disabled.
 */
export const HTML_VIEWER_CSS = `
:root {
  color-scheme: dark;
  --bg: #0b120f;
  --bg-soft: #111a15;
  --panel: rgba(18, 27, 22, 0.88);
  --line: rgba(231, 197, 109, 0.24);
  --line-soft: rgba(244, 238, 224, 0.12);
  --ink: #f4eee0;
  --ink-soft: #c8c4b6;
  --ink-muted: #8f9488;
  --brass: #e7c56d;
  --brass-soft: rgba(231, 197, 109, 0.13);
  --moss: #78a886;
  --danger: #e58f7f;
  --mono: "Cascadia Mono", "Cascadia Code", Consolas, "SFMono-Regular", monospace;
  --sans: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  overflow: hidden;
  color: var(--ink);
  font-family: var(--sans);
  background:
    radial-gradient(circle at 18% 8%, rgba(92, 139, 108, 0.24), transparent 34%),
    radial-gradient(circle at 82% 4%, rgba(189, 148, 64, 0.14), transparent 30%),
    linear-gradient(180deg, #16211b 0%, #0c1410 55%, #080d0a 100%);
}
#viewer { position: fixed; inset: 0; }
#scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  cursor: grab;
  outline: none;
}
#scene:active { cursor: grabbing; }
#scene:focus-visible { outline: 2px solid var(--brass); outline-offset: -2px; }
.hud { position: absolute; inset: 0; pointer-events: none; }
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(12px);
}
.interactive { pointer-events: auto; }
.brandbar {
  position: absolute;
  top: 18px;
  left: 18px;
  max-width: min(520px, calc(100vw - 360px));
  padding: 14px 18px 15px;
  display: flex;
  gap: 13px;
  align-items: flex-start;
}
.brand-mark {
  width: 38px;
  height: 38px;
  flex: none;
  color: var(--brass);
  filter: drop-shadow(0 2px 10px rgba(231, 197, 109, 0.28));
}
.brand-copy { min-width: 0; }
.brand-name {
  display: block;
  font-family: var(--serif);
  font-size: 22px;
  line-height: 1;
  letter-spacing: 0.01em;
}
.brand-tag {
  display: block;
  margin-top: 4px;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brass);
}
h1 {
  margin: 8px 0 2px;
  font-family: var(--serif);
  font-size: clamp(20px, 2.4vw, 30px);
  font-weight: 500;
  line-height: 1.08;
}
.subtitle { margin: 0; color: var(--ink-soft); font-size: 12px; line-height: 1.5; }
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 9px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(120, 168, 134, 0.38);
  background: rgba(120, 168, 134, 0.12);
  color: #b8ddc2;
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.badge::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8ed5a4;
  box-shadow: 0 0 8px #8ed5a4;
}
.controls {
  position: absolute;
  top: 18px;
  right: 18px;
  padding: 10px;
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.view-button {
  appearance: none;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--ink-soft);
  font: 600 11px/1 var(--sans);
  letter-spacing: 0.05em;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}
.view-button:hover { color: var(--ink); border-color: rgba(231, 197, 109, 0.42); background: rgba(231, 197, 109, 0.08); }
.view-button.is-active {
  color: #211b0e;
  border-color: var(--brass);
  background: var(--brass);
}
.view-button:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }
.info {
  position: absolute;
  top: 92px;
  right: 18px;
  width: min(340px, calc(100vw - 36px));
  max-height: calc(100vh - 190px);
  overflow: auto;
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(231, 197, 109, 0.36) transparent;
}
.info h2, .info h3 {
  margin: 0;
  font-family: var(--serif);
  font-weight: 500;
}
.info h2 { font-size: 15px; }
.info h3 {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--line-soft);
  font-size: 11px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--brass);
}
.meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin-top: 10px; }
.meta-key {
  color: var(--ink-muted);
  font-size: 9px;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  padding-top: 2px;
}
.meta-value { color: var(--ink-soft); font-family: var(--mono); font-size: 10.5px; line-height: 1.45; overflow-wrap: anywhere; }
.summary { margin: 12px 0 0; color: var(--ink-soft); font-size: 11.5px; line-height: 1.55; }
.stat-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.stat {
  padding: 8px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
}
.stat strong { display: block; font-family: var(--mono); font-size: 13px; color: var(--ink); }
.stat span { display: block; margin-top: 3px; font-size: 8.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
.notice {
  margin-top: 12px;
  padding: 8px 9px;
  border-left: 2px solid var(--brass);
  border-radius: 0 6px 6px 0;
  background: var(--brass-soft);
  color: var(--ink-soft);
  font-size: 10px;
  line-height: 1.5;
}
.hint {
  position: absolute;
  left: 18px;
  bottom: 42px;
  padding: 8px 11px;
  color: var(--ink-muted);
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.02em;
}
.hint b { color: var(--ink-soft); font-weight: 600; }
.attribution {
  position: absolute;
  left: 18px;
  bottom: 12px;
  max-width: min(760px, calc(100vw - 36px));
  color: rgba(200, 196, 182, 0.56);
  font-size: 9px;
  line-height: 1.45;
}
.attribution strong { color: rgba(231, 197, 109, 0.8); font-weight: 600; }
.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(8, 13, 10, 0.72);
  transition: opacity 220ms ease;
}
.loading[hidden] { display: none; }
.loading-card { padding: 18px 22px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); text-align: center; }
.spinner {
  width: 22px;
  height: 22px;
  margin: 0 auto 10px;
  border: 2px solid rgba(231, 197, 109, 0.22);
  border-top-color: var(--brass);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
.loading-card p { margin: 0; color: var(--ink-soft); font-size: 11px; }
.fallback {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(460px, calc(100vw - 32px));
  padding: 20px;
  border: 1px solid rgba(229, 143, 127, 0.45);
  border-radius: 12px;
  background: var(--panel);
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.55;
}
.fallback[hidden] { display: none; }
.fallback strong { display: block; margin-bottom: 6px; color: var(--danger); }
.noscript {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #0b120f;
  color: #f4eee0;
  font-family: var(--sans);
  text-align: center;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) {
  .brandbar { max-width: calc(100vw - 36px); }
  .controls { top: auto; bottom: 44px; left: 18px; right: auto; justify-content: flex-start; }
  .info { top: auto; bottom: 96px; left: 18px; right: 18px; width: auto; max-height: 38vh; }
  .hint { display: none; }
  .attribution { bottom: 10px; }
}
@media (max-width: 620px) {
  .brandbar { padding: 11px 13px 12px; }
  .brand-mark { width: 30px; height: 30px; }
  .brand-name { font-size: 18px; }
  h1 { font-size: 20px; }
  .info { bottom: 104px; max-height: 34vh; }
  .stat-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

export const HTML_VIEWER_SCRIPT = String.raw`
(function () {
  "use strict";
  var DATA = __QR_DATA__;
  var canvas = document.getElementById("scene");
  var fallback = document.getElementById("fallback");
  var loading = document.getElementById("loading");
  var gl = canvas.getContext("webgl2", {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance"
  });
  if (!gl) {
    showFallback("This viewer needs WebGL 2. Your browser or graphics driver did not provide it.");
    return;
  }

  function showFallback(message) {
    fallback.hidden = false;
    fallback.textContent = "";
    var strong = document.createElement("strong");
    strong.textContent = "Viewer unavailable";
    var copy = document.createElement("span");
    copy.textContent = message;
    fallback.appendChild(strong);
    fallback.appendChild(copy);
    if (loading) loading.hidden = true;
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value == null ? "" : String(value);
  }

  // ---------------------------------------------------------------------------
  // Embedded metadata
  // ---------------------------------------------------------------------------
  var meta = DATA.meta;
  var world = DATA.world;
  document.title = "QRCraft - " + meta.title;
  setText("world-title", meta.site + " \u00b7 " + meta.style);
  setText("world-subtitle", meta.quality + " build \u00b7 seed " + meta.seed + " \u00b7 " + meta.size + "\u00b2 world");
  setText("summary", meta.summary);

  var metaGrid = document.getElementById("meta-grid");
  var rows = [
    ["Payload", meta.payload],
    ["World site", meta.site],
    ["Architecture", meta.style],
    ["Quality", meta.quality],
    ["World size", meta.size + " x " + meta.height + " x " + meta.size],
    ["QR", meta.moduleCount + " modules at " + meta.cellSize + " blocks"],
    ["Construction", meta.buildings + " buildings / " + meta.structures + " structures"],
    ["Exposed shell", meta.blockCount.toLocaleString() + " blocks"],
    ["Generated", meta.generatedAt]
  ];
  rows.forEach(function (row) {
    var key = document.createElement("span");
    key.className = "meta-key";
    key.textContent = row[0];
    var value = document.createElement("span");
    value.className = "meta-value";
    value.textContent = row[1];
    metaGrid.appendChild(key);
    metaGrid.appendChild(value);
  });

  var statRow = document.getElementById("stats");
  [
    [meta.blockCount.toLocaleString(), "exposed blocks"],
    [meta.materialCount.toLocaleString(), "materials"],
    [meta.size + "\u00b2", "world footprint"]
  ].forEach(function (stat) {
    var item = document.createElement("div");
    item.className = "stat";
    var strong = document.createElement("strong");
    strong.textContent = stat[0];
    var label = document.createElement("span");
    label.textContent = stat[1];
    item.appendChild(strong);
    item.appendChild(label);
    statRow.appendChild(item);
  });

  // ---------------------------------------------------------------------------
  // Embedded data and GL setup
  // ---------------------------------------------------------------------------
  function decodeBase64(input) {
    var binary = atob(input);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function compileShader(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader) || "Unknown shader error";
      gl.deleteShader(shader);
      throw new Error(log);
    }
    return shader;
  }

  function createProgram(vertexSource, fragmentSource) {
    var vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
    var fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(program) || "Unknown program link error";
      gl.deleteProgram(program);
      throw new Error(log);
    }
    return program;
  }

  var vertexSource = [
    "#version 300 es",
    "layout(location = 0) in vec3 aPosition;",
    "layout(location = 1) in vec3 aNormal;",
    "layout(location = 2) in vec2 aUv;",
    "layout(location = 3) in vec3 aOffset;",
    "uniform mat4 uViewProj;",
    "uniform vec3 uEye;",
    "uniform float uFogNear;",
    "uniform float uFogFar;",
    "out vec3 vNormal;",
    "out vec2 vUv;",
    "out float vFog;",
    "void main() {",
    "  vec3 worldPosition = aPosition + aOffset;",
    "  gl_Position = uViewProj * vec4(worldPosition, 1.0);",
    "  vNormal = aNormal;",
    "  vUv = aUv;",
    "  vFog = clamp((distance(worldPosition, uEye) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);",
    "}"
  ].join("\n");

  var fragmentSource = [
    "#version 300 es",
    "precision highp float;",
    "uniform sampler2D uAtlas;",
    "uniform vec2 uTile;",
    "uniform vec2 uTiles;",
    "uniform vec3 uLightDir;",
    "uniform vec3 uFogColor;",
    "uniform float uAlpha;",
    "uniform float uEmissive;",
    "in vec3 vNormal;",
    "in vec2 vUv;",
    "in float vFog;",
    "out vec4 outColor;",
    "void main() {",
    "  vec4 texel = texture(uAtlas, (vUv + uTile) / uTiles);",
    "  float diffuse = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);",
    "  vec3 color = texel.rgb * (0.62 + 0.38 * diffuse);",
    "  color = mix(color, texel.rgb * 1.18, uEmissive);",
    "  color = mix(color, uFogColor, vFog * 0.55);",
    "  outColor = vec4(color, uAlpha);",
    "}"
  ].join("\n");

  var program;
  try {
    program = createProgram(vertexSource, fragmentSource);
  } catch (error) {
    showFallback("The embedded shaders could not be compiled: " + error.message);
    return;
  }

  var uniforms = {
    viewProj: gl.getUniformLocation(program, "uViewProj"),
    eye: gl.getUniformLocation(program, "uEye"),
    fogNear: gl.getUniformLocation(program, "uFogNear"),
    fogFar: gl.getUniformLocation(program, "uFogFar"),
    atlas: gl.getUniformLocation(program, "uAtlas"),
    tile: gl.getUniformLocation(program, "uTile"),
    tiles: gl.getUniformLocation(program, "uTiles"),
    lightDir: gl.getUniformLocation(program, "uLightDir"),
    fogColor: gl.getUniformLocation(program, "uFogColor"),
    alpha: gl.getUniformLocation(program, "uAlpha"),
    emissive: gl.getUniformLocation(program, "uEmissive")
  };

  // Unit cube, 6 faces x 2 triangles. Face normals drive the simple lambert
  // shading; the atlas supplies the same procedural texture pixels as the app.
  var cube = (function () {
    var positions = [];
    var normals = [];
    var uvs = [];
    var faceUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    function quad(a, b, c, d, normal) {
      var points = [a, b, c, d];
      var order = [0, 1, 2, 0, 2, 3];
      for (var i = 0; i < order.length; i++) {
        var p = points[order[i]];
        var uv = faceUvs[order[i]];
        positions.push(p[0], p[1], p[2]);
        normals.push(normal[0], normal[1], normal[2]);
        uvs.push(uv[0], uv[1]);
      }
    }
    quad([1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]);
    quad([0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1], [-1, 0, 0]);
    quad([0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1], [0, 1, 0]);
    quad([0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0], [0, -1, 0]);
    quad([0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]);
    quad([1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, -1]);
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs)
    };
  })();

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  function staticAttribute(location, data, size) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }
  staticAttribute(0, cube.positions, 3);
  staticAttribute(1, cube.normals, 3);
  staticAttribute(2, cube.uvs, 2);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribDivisor(3, 1);

  var groups = [];
  DATA.groups.forEach(function (group) {
    var bytes = decodeBase64(group.data);
    if (bytes.byteLength !== group.count * 6) {
      throw new Error("Embedded block data is truncated.");
    }
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.STATIC_DRAW);
    groups.push({
      palette: group.palette,
      count: group.count,
      buffer: buffer,
      transparent: Boolean(DATA.palette[group.palette].transparent),
      alpha: DATA.palette[group.palette].alpha,
      emissive: DATA.palette[group.palette].emissive
    });
  });
  groups.sort(function (a, b) {
    if (a.transparent !== b.transparent) return a.transparent ? 1 : -1;
    return a.palette - b.palette;
  });

  var atlasBytes = decodeBase64(DATA.atlas.data);
  var atlasTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, DATA.atlas.width, DATA.atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlasBytes);
  var anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropy) {
    var maxAnisotropy = gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, maxAnisotropy));
  }

  // ---------------------------------------------------------------------------
  // Camera, orbit, pan, zoom and view presets
  // ---------------------------------------------------------------------------
  var span = Math.max(96, world.span);
  var focus = world.focus.slice();
  var camera = {
    target: focus.slice(),
    yaw: 0.72,
    pitch: 0.56,
    distance: span * 1.55,
    ortho: false,
    orthoScale: span * 0.55
  };
  var minDistance = Math.max(8, span * 0.12);
  var maxDistance = span * 6.5;
  var fov = 42 * Math.PI / 180;
  var animation = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function length3(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
  function normalize3(v) {
    var length = length3(v) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }
  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function cameraEye() {
    var cp = Math.cos(camera.pitch);
    return [
      camera.target[0] + camera.distance * cp * Math.sin(camera.yaw),
      camera.target[1] + camera.distance * Math.sin(camera.pitch),
      camera.target[2] + camera.distance * cp * Math.cos(camera.yaw)
    ];
  }

  function cameraBasis(eye) {
    var backward = normalize3([eye[0] - camera.target[0], eye[1] - camera.target[1], eye[2] - camera.target[2]]);
    var up = Math.abs(backward[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0];
    var right = normalize3(cross3(up, backward));
    var cameraUp = cross3(backward, right);
    return { right: right, up: cameraUp, backward: backward };
  }

  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) / (near - far); out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = (2 * far * near) / (near - far); out[15] = 0;
    return out;
  }

  function orthographic(out, halfWidth, halfHeight, near, far) {
    out[0] = 1 / halfWidth; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 1 / halfHeight; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = -2 / (far - near); out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = -(far + near) / (far - near); out[15] = 1;
    return out;
  }

  function lookAt(out, eye, center) {
    var backward = normalize3([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    var up = Math.abs(backward[1]) > 0.999 ? [0, 0, -1] : [0, 1, 0];
    var right = normalize3(cross3(up, backward));
    var cameraUp = cross3(backward, right);
    out[0] = right[0]; out[1] = cameraUp[0]; out[2] = backward[0]; out[3] = 0;
    out[4] = right[1]; out[5] = cameraUp[1]; out[6] = backward[1]; out[7] = 0;
    out[8] = right[2]; out[9] = cameraUp[2]; out[10] = backward[2]; out[11] = 0;
    out[12] = -dot3(right, eye);
    out[13] = -dot3(cameraUp, eye);
    out[14] = -dot3(backward, eye);
    out[15] = 1;
    return out;
  }

  function multiply(out, a, b) {
    for (var column = 0; column < 4; column++) {
      for (var row = 0; row < 4; row++) {
        out[column * 4 + row] =
          a[row] * b[column * 4] +
          a[4 + row] * b[column * 4 + 1] +
          a[8 + row] * b[column * 4 + 2] +
          a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }

  var projection = new Float32Array(16);
  var view = new Float32Array(16);
  var viewProjection = new Float32Array(16);

  function updateMatrices() {
    var eye = cameraEye();
    var near = 0.5;
    var far = span * 8 + 2000;
    var aspect = canvas.width / Math.max(1, canvas.height);
    if (camera.ortho) {
      var halfHeight = camera.orthoScale * Math.max(1, 1 / aspect);
      var halfWidth = halfHeight * aspect;
      orthographic(projection, halfWidth, halfHeight, near, far);
    } else {
      perspective(projection, fov, aspect, near, far);
    }
    lookAt(view, eye, camera.target);
    multiply(viewProjection, projection, view);
    return eye;
  }

  function panScale() {
    if (camera.ortho) {
      var aspect = canvas.width / Math.max(1, canvas.height);
      var halfHeight = camera.orthoScale * Math.max(1, 1 / aspect);
      return (2 * halfHeight) / Math.max(1, canvas.clientHeight);
    }
    return (2 * camera.distance * Math.tan(fov / 2)) / Math.max(1, canvas.clientHeight);
  }

  function viewPreset(name) {
    var preset = name;
    if (preset === "reset") preset = "iso";
    if (preset === "top") {
      return {
        yaw: 0,
        pitch: Math.PI / 2,
        distance: span * 2.2,
        ortho: true,
        orthoScale: span * 0.55
      };
    }
    if (preset === "front") {
      return {
        yaw: 0,
        pitch: 0.1,
        distance: span * 1.45,
        ortho: false,
        orthoScale: span * 0.55
      };
    }
    return {
      yaw: 0.72,
      pitch: 0.56,
      distance: span * 1.55,
      ortho: false,
      orthoScale: span * 0.55
    };
  }

  function setActiveView(name) {
    var buttons = document.querySelectorAll("[data-view]");
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute("data-view") === name;
      buttons[i].classList.toggle("is-active", active);
      buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function goToView(name) {
    var preset = viewPreset(name);
    camera.ortho = preset.ortho;
    animation = {
      start: performance.now(),
      duration: 650,
      from: {
        target: camera.target.slice(),
        yaw: camera.yaw,
        pitch: camera.pitch,
        distance: camera.distance,
        orthoScale: camera.orthoScale
      },
      to: {
        target: focus.slice(),
        yaw: preset.yaw,
        pitch: preset.pitch,
        distance: preset.distance,
        orthoScale: preset.orthoScale
      }
    };
    setActiveView(name);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerpAngle(a, b, t) {
    var delta = (b - a) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return a + delta * t;
  }

  function updateAnimation(now) {
    if (!animation) return;
    var progress = clamp((now - animation.start) / animation.duration, 0, 1);
    var t = easeInOutCubic(progress);
    camera.target[0] = animation.from.target[0] + (animation.to.target[0] - animation.from.target[0]) * t;
    camera.target[1] = animation.from.target[1] + (animation.to.target[1] - animation.from.target[1]) * t;
    camera.target[2] = animation.from.target[2] + (animation.to.target[2] - animation.from.target[2]) * t;
    camera.yaw = lerpAngle(animation.from.yaw, animation.to.yaw, t);
    camera.pitch = animation.from.pitch + (animation.to.pitch - animation.from.pitch) * t;
    camera.distance = animation.from.distance + (animation.to.distance - animation.from.distance) * t;
    camera.orthoScale = animation.from.orthoScale + (animation.to.orthoScale - animation.from.orthoScale) * t;
    if (progress >= 1) animation = null;
  }

  var pointers = new Map();
  var drag = null;
  var pinch = null;

  function cancelAnimation() {
    animation = null;
    setActiveView("");
  }

  canvas.addEventListener("contextmenu", function (event) { event.preventDefault(); });
  canvas.addEventListener("pointerdown", function (event) {
    canvas.focus();
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    cancelAnimation();
    if (pointers.size === 1) {
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pan: event.button === 1 || event.button === 2 || event.shiftKey
      };
      pinch = null;
    } else if (pointers.size === 2) {
      var entries = Array.from(pointers.values());
      var dx = entries[0].x - entries[1].x;
      var dy = entries[0].y - entries[1].y;
      pinch = {
        start: Math.max(1, Math.hypot(dx, dy)),
        distance: camera.distance,
        orthoScale: camera.orthoScale
      };
      drag = null;
    }
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size >= 2) {
      var entries = Array.from(pointers.values());
      var dx = entries[0].x - entries[1].x;
      var dy = entries[0].y - entries[1].y;
      var spread = Math.max(1, Math.hypot(dx, dy));
      if (camera.ortho) {
        camera.orthoScale = clamp(pinch.orthoScale * (pinch.start / spread), span * 0.08, span * 2);
      } else {
        camera.distance = clamp(pinch.distance * (pinch.start / spread), minDistance, maxDistance);
      }
      return;
    }
    if (!drag || drag.id !== event.pointerId) return;
    var deltaX = event.clientX - drag.x;
    var deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.pan) {
      var eye = cameraEye();
      var basis = cameraBasis(eye);
      var scale = panScale();
      camera.target[0] += (-basis.right[0] * deltaX + basis.up[0] * deltaY) * scale;
      camera.target[1] += (-basis.right[1] * deltaX + basis.up[1] * deltaY) * scale;
      camera.target[2] += (-basis.right[2] * deltaX + basis.up[2] * deltaY) * scale;
    } else {
      camera.yaw -= deltaX * 0.0045;
      camera.pitch = clamp(camera.pitch + deltaY * 0.0045, 0.02, Math.PI / 2 - 0.0001);
    }
    cancelAnimation();
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    if (drag && drag.id === event.pointerId) drag = null;
    if (pointers.size < 2) pinch = null;
  }
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    cancelAnimation();
    if (camera.ortho) {
      camera.orthoScale = clamp(
        camera.orthoScale * Math.exp(event.deltaY * 0.0011),
        span * 0.08,
        span * 2
      );
    } else {
      camera.distance = clamp(
        camera.distance * Math.exp(event.deltaY * 0.0011),
        minDistance,
        maxDistance
      );
    }
  }, { passive: false });

  var buttons = document.querySelectorAll("[data-view]");
  for (var buttonIndex = 0; buttonIndex < buttons.length; buttonIndex++) {
    buttons[buttonIndex].addEventListener("click", function (event) {
      goToView(event.currentTarget.getAttribute("data-view"));
    });
  }
  window.addEventListener("keydown", function (event) {
    if (event.key === "1") goToView("top");
    else if (event.key === "2") goToView("front");
    else if (event.key === "3") goToView("iso");
    else if (event.key === "0" || event.key === "r" || event.key === "R") goToView("reset");
  });

  function resize() {
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    var width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    var height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(canvas);
  }

  // ---------------------------------------------------------------------------
  // Draw loop
  // ---------------------------------------------------------------------------
  var fogColor = [0.78, 0.83, 0.8];
  var firstFrame = true;

  function drawGroup(group) {
    gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer);
    gl.vertexAttribPointer(3, 3, gl.UNSIGNED_SHORT, false, 6, 0);
    gl.uniform2f(uniforms.tile, group.palette % DATA.atlas.cols, Math.floor(group.palette / DATA.atlas.cols));
    gl.uniform1f(uniforms.alpha, group.alpha);
    gl.uniform1f(uniforms.emissive, group.emissive);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, group.count);
  }

  function draw() {
    resize();
    var now = performance.now();
    updateAnimation(now);
    var eye = updateMatrices();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.uniform1i(uniforms.atlas, 0);
    gl.uniformMatrix4fv(uniforms.viewProj, false, viewProjection);
    gl.uniform3f(uniforms.eye, eye[0], eye[1], eye[2]);
    gl.uniform1f(uniforms.fogNear, span * 1.15);
    gl.uniform1f(uniforms.fogFar, span * 3.4);
    gl.uniform3f(uniforms.fogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform3f(uniforms.lightDir, 0.42, 0.86, 0.32);
    gl.uniform2f(uniforms.tiles, DATA.atlas.cols, DATA.atlas.rows);

    gl.depthMask(true);
    for (var i = 0; i < groups.length; i++) {
      if (!groups[i].transparent) drawGroup(groups[i]);
    }
    gl.depthMask(false);
    for (var j = 0; j < groups.length; j++) {
      if (groups[j].transparent) drawGroup(groups[j]);
    }
    gl.depthMask(true);

    if (firstFrame) {
      firstFrame = false;
      if (loading) loading.hidden = true;
    }
    requestAnimationFrame(draw);
  }

  resize();
  requestAnimationFrame(draw);
})();
`;
