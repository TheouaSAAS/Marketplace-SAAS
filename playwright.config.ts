import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout (navigateur réel) sur le serveur de PRODUCTION.
 * Prérequis : `npm run build`.
 *
 * Navigateur : Microsoft Edge installé sur le poste (PW_CHANNEL=msedge par
 * défaut), pour éviter tout téléchargement. En CI : PW_CHANNEL=chromium après
 * `npx playwright install chromium`.
 */
const channel = process.env.PW_CHANNEL ?? "msedge";
const port = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    timezoneId: "Africa/Abidjan",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: channel === "chromium" ? undefined : channel },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Edge"], channel: channel === "chromium" ? undefined : channel, viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Limites anti-abus relevées pour que les connexions répétées des tests ne se bloquent pas.
    env: { NEXT_TELEMETRY_DISABLED: "1", RATE_LIMIT_SCALE: "50" },
  },
});
