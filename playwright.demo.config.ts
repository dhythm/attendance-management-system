import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

const PORT = 3200;

export default defineConfig({
  ...baseConfig,
  testDir: "tests/demo",
  outputDir: "test-results/demo",
  reporter: "list",
  timeout: 120_000,
  use: {
    ...baseConfig.use,
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    video: { mode: "on", size: { width: 1280, height: 800 } },
    launchOptions: { slowMo: 250 },
  },
  projects: undefined,
  webServer: baseConfig.webServer && {
    ...baseConfig.webServer,
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
  },
});
