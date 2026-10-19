import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  outputDir: "runtime/browser-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4190",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node server/index.mjs",
    url: "http://127.0.0.1:4190/api/health",
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      PORT: "4190",
      DATABASE_MEMORY: "1",
      DATABASE_URL: "",
      IDENTITY_DATABASE_URL: "",
      WORKSPACE_PORT: "4191",
      IDENTITY_PORT: "4192",
      RANKING_PORT: "4193",
    },
  },
});
