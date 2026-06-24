import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm.cmd run dev -- --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DISABLE_GEMINI: "1",
      ANALYTICS_PATH: "storage/e2e-analytics.ndjson",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
