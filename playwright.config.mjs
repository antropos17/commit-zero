import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  globalSetup: "./tests/browser/setup.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir: "runtime/browser-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4190",
    browserName: "chromium",
    ...(process.env.CZ_BROWSER_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.CZ_BROWSER_EXECUTABLE } }
      : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
