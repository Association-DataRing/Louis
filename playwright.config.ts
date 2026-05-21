import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-test config for Louis. Hits a locally running dev/build server.
 * Use `npm run test:e2e` after `npm run dev` (or `npm run build && start`).
 *
 * Tests assume the database has been seeded with the user defined by the
 * E2E_EMAIL / E2E_PASSWORD env vars (defaults: admin@louis.local / password).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
