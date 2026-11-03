import { defineConfig } from "@playwright/test";

/**
 * Production smoke tests. The suite builds the app and serves it on port 3100
 * so it never collides with a developer server on 3000 or 3001. Playwright uses
 * the locally installed Chrome channel; no browser download is required.
 */
export default defineConfig({
  testDir: "./src/tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 420_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    headless: true,
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
    // Traces record DOM snapshots and screenshots throughout this long,
    // WebGL-heavy run. They are not needed for the acceptance test and add
    // meaningful overhead, so keep failure screenshots only.
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 360_000,
  },
});
