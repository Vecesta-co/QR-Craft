import { test, expect } from "@playwright/test";
import { stat, writeFile } from "node:fs/promises";
import QRCode from "qrcode";

test.describe.configure({ mode: "serial" });
test.setTimeout(420_000);

test("generates, certifies, explores, and exports a kingdom", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByTestId("payload-input")).toHaveValue("https://example.com/qrcraft");
  await expect(page.getByTestId("qr-status")).toContainText("Not tested");

  const preview = page.locator(".qr-preview canvas");
  await expect(preview).toBeVisible();
  const previewBytes = await preview.evaluate((canvas) => {
    return (canvas as HTMLCanvasElement).toDataURL("image/png").length;
  });
  expect(previewBytes).toBeGreaterThan(2_000);

  await expect(page.getByTestId("stage-progress")).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "8×" }).click();
  await expect(page.getByTestId("stage-progress")).toBeHidden({ timeout: 300_000 });
  await expect(page.getByTestId("qr-status")).toHaveText("QR VERIFIED", { timeout: 150_000 });

  await page.getByTestId("tab-verify").click();
  await expect(page.locator(".cert-hero h3")).toHaveText("QR VERIFIED");
  await expect(page.locator(".verify-grid")).toContainText("Exact");
  await expect(page.locator(".verify-grid")).toContainText("4 / 4 variants");
  await expect(page.locator(".cert-facts")).toContainText(/All [\d,]+ columns match/);
  await expect(page.getByAltText(/Top-down capture of the live 3D scene/)).toBeVisible();

  await page.getByTestId("view-top").click();
  await expect(page.locator(".topview-note")).toBeVisible();

  await page.getByTestId("view-explore").click();
  await expect(page.getByTestId("explore-lock")).toBeVisible();
  await page.getByTestId("explore-lock").click();
  await expect(page.locator(".crosshair")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(document.pointerLockElement))).toBe(true);

  const beforeMove = await page.screenshot();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(900);
  await page.keyboard.up("KeyW");
  const afterMove = await page.screenshot();
  expect(Buffer.compare(beforeMove, afterMove)).not.toBe(0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("explore-lock")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Leave explore" }).click();
  await expect(page.getByTestId("view-showcase")).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("tab-export").click();
  const glbDownload = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByTestId("export-glb").click();
  const glb = await glbDownload;
  expect(glb.suggestedFilename()).toMatch(/^qrcraft-.*\.glb$/);
  const glbPath = test.info().outputPath(glb.suggestedFilename());
  await glb.saveAs(glbPath);
  expect((await stat(glbPath)).size).toBeGreaterThan(10_000);

  const schematicDownload = page.waitForEvent("download", { timeout: 180_000 });
  await page.getByTestId("export-schem").click();
  const schematic = await schematicDownload;
  expect(schematic.suggestedFilename()).toMatch(/^qrcraft-.*\.schem$/);
  const schematicPath = test.info().outputPath(schematic.suggestedFilename());
  await schematic.saveAs(schematicPath);
  expect((await stat(schematicPath)).size).toBeGreaterThan(1_000);

  // Uploading a real QR image must decode it locally and invalidate the old
  // certification, because the form no longer describes the displayed world.
  const uploadPath = test.info().outputPath("uploaded-qr.png");
  const uploadBuffer = await QRCode.toBuffer("https://qrcraft.test/uploaded", {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 512,
  });
  await writeFile(uploadPath, uploadBuffer);
  await page.getByTestId("upload-input").setInputFiles(uploadPath);
  await expect(page.getByTestId("payload-input")).toHaveValue("https://qrcraft.test/uploaded");
  await expect(page.getByTestId("dirty-note")).toBeVisible();
  await expect(page.getByTestId("qr-status")).not.toHaveText("QR VERIFIED");
  await expect(page.locator(".topbar__payload")).toContainText("https://example.com/qrcraft");

  expect(consoleErrors).toEqual([]);
});
