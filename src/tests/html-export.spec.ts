import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { writeStandaloneHtml } from "@/lib/export/html";
import { createQrMatrix } from "@/lib/qr/matrix";
import { generateWorld } from "@/lib/world/generate";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

test.use({
  launchOptions: {
    args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"],
  },
});

let directory = "";
let fileUrl = "";
let expectedTitle = "";

test.beforeAll(() => {
  const qr = createQrMatrix("https://example.com/qrcraft", {
    errorCorrectionLevel: "M",
    quietZone: 4,
  });
  const result = generateWorld({
    qr,
    seed: 1337,
    size: 128,
    site: "hamlet",
    style: "royal",
    quality: "showcase",
    complexity: "balanced",
  });
  expectedTitle = `${result.brief.siteLabel} · ${result.brief.styleLabel}`;
  directory = mkdtempSync(join(tmpdir(), "qrcraft-html-"));
  const file = join(directory, "qrcraft-standalone.html");
  writeFileSync(
    file,
    writeStandaloneHtml(result.finalWorld, {
      payload: qr.payload,
      seed: 1337,
      siteLabel: result.brief.siteLabel,
      styleLabel: result.brief.styleLabel,
      qualityLabel: result.brief.qualityLabel,
      summary: result.brief.summary,
      moduleCount: qr.moduleCount,
      cellSize: result.layout.cellSize,
      buildings: result.stats.buildings,
      structures: result.stats.structures,
      generatedAt: "2026-11-01T00:00:00.000Z",
    }),
  );
  fileUrl = pathToFileURL(file).href;
});

test.afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

function hash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function differingPixels(left: Buffer, right: Buffer): number {
  const a = PNG.sync.read(left);
  const b = PNG.sync.read(right);
  if (a.width !== b.width || a.height !== b.height) return 1;
  let different = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    const delta =
      Math.abs(a.data[index] - b.data[index]) +
      Math.abs(a.data[index + 1] - b.data[index + 1]) +
      Math.abs(a.data[index + 2] - b.data[index + 2]);
    if (delta > 24) different += 1;
  }
  return different / (a.width * a.height);
}

test("the exported file works offline and every camera control responds", async ({ browser }) => {
  // Offline context: any attempted HTTP(S) request fails and is recorded.
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });

  await page.goto(fileUrl, { waitUntil: "load" });
  await expect(page.locator("#loading")).toBeHidden({ timeout: 20_000 });
  await expect(page.locator("#fallback")).toBeHidden();

  expect(await page.title()).toBe(`QRCraft - ${expectedTitle}`);
  await expect(page.locator("#world-title")).toHaveText(expectedTitle);
  await expect(page.locator("#meta-grid")).toContainText("https://example.com/qrcraft");
  await expect(page.locator("#meta-grid")).toContainText("Showcase");
  await expect(page.locator("#world-subtitle")).toContainText("seed 1337");
  await expect(page.locator(".attribution")).toContainText("not affiliated");
  await expect(page.locator(".attribution")).toContainText("QRCraft");

  const canvas = page.locator("#scene");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("The viewer canvas has no layout box.");
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  const gl = await page.evaluate(() => {
    const canvasElement = document.getElementById("scene") as HTMLCanvasElement | null;
    if (!canvasElement) return null;
    const context2 = canvasElement.getContext("webgl2");
    return {
      width: canvasElement.width,
      height: canvasElement.height,
      webgl2: Boolean(context2),
    };
  });
  expect(gl?.webgl2).toBe(true);
  expect(gl?.width).toBeGreaterThan(0);
  expect(gl?.height).toBeGreaterThan(0);

  async function capture(): Promise<Buffer> {
    // Camera preset animation is 650 ms; allow it to settle fully.
    await page.waitForTimeout(900);
    return canvas.screenshot();
  }

  const initial = await capture();
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "iso",
  );

  await page.getByRole("button", { name: "Top", exact: true }).click();
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "top",
  );
  const top = await capture();
  expect(differingPixels(initial, top)).toBeGreaterThan(0.02);

  await page.getByRole("button", { name: "Front", exact: true }).click();
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "front",
  );
  const front = await capture();
  expect(differingPixels(top, front)).toBeGreaterThan(0.02);

  await page.getByRole("button", { name: "Isometric", exact: true }).click();
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "iso",
  );
  const isometric = await capture();
  expect(differingPixels(front, isometric)).toBeGreaterThan(0.02);

  // Orbit: a left-drag changes the yaw/pitch and clears the active preset.
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 170, centerY + 70, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator("[data-view].is-active")).toHaveCount(0);
  const orbit = await capture();
  expect(differingPixels(isometric, orbit)).toBeGreaterThan(0.02);

  // Zoom: the wheel changes the camera distance.
  await page.mouse.move(centerX, centerY);
  await page.mouse.wheel(0, -700);
  const zoom = await capture();
  expect(differingPixels(orbit, zoom)).toBeGreaterThan(0.02);

  // Pan: Shift-drag moves the camera target.
  await page.keyboard.down("Shift");
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 120, centerY + 90, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const pan = await capture();
  expect(differingPixels(zoom, pan)).toBeGreaterThan(0.02);

  // Reset returns to the same isometric camera. The only pixel differences
  // should be the active-button highlight in the HUD.
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "reset",
  );
  const reset = await capture();
  expect(differingPixels(pan, reset)).toBeGreaterThan(0.02);
  expect(differingPixels(initial, reset)).toBeLessThan(0.02);

  // Keyboard shortcuts use the same camera presets.
  await page.keyboard.press("1");
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "top",
  );
  await page.waitForTimeout(800);
  await page.keyboard.press("3");
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "iso",
  );
  await page.waitForTimeout(800);
  await page.keyboard.press("0");
  await expect(page.locator('[data-view][aria-pressed="true"]')).toHaveAttribute(
    "data-view",
    "reset",
  );

  expect(externalRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();

  // Keep the hash helper used so a failure in screenshot capture is explicit.
  expect(hash(initial)).not.toBe(hash(top));
});
