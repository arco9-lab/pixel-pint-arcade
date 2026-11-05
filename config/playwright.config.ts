import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  globalTimeout: process.env.CI ? 10 * 60 * 1000 : undefined,
  outputDir: "../test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node tests/e2e/start-test-server.mjs",
    cwd: "..",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:3100",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
