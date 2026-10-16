import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);

/**
 * Smoke tests for public pages, auth redirects and responsive layout.
 * They run without external services: data-driven sections fall back to
 * empty states. Set PLAYWRIGHT_CHANNEL=chromium after `npx playwright install`
 * if Microsoft Edge is not available.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Edge"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        port,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
