import { defineConfig, devices } from "@playwright/test"
import { SESSION_FILE } from "./support/paths"

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:5173"
const isCI = Boolean(process.env["CI"])

/**
 * The panel's e2e smoke tests (docs/07, docs/06): a temporary admin signs
 * in, the main screens open without errors, a few read-only flows work,
 * and axe finds no serious accessibility issue. They run against the
 * panel's dev server (started here if it is not running) and a backend
 * that is: `pnpm --filter backend dev`. Nothing they do writes data,
 * apart from the temporary admin, which the teardown deletes, and what a
 * test removes itself (a look's saved drafts, a product's video: the
 * video test also needs ffmpeg on both machines).
 */
export default defineConfig({
  testDir: ".",
  outputDir: "./.results",
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 2,
  reporter: [[isCI ? "github" : "list"], ["html", { open: "never", outputFolder: "./.report" }]],
  use: {
    baseURL,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "teardown" },
    { name: "teardown", testMatch: /auth\.teardown\.ts/ },
    {
      name: "chromium",
      testMatch: /\.e2e\.ts$/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: SESSION_FILE },
    },
  ],
  webServer: {
    command: "pnpm dev",
    cwd: "..",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
