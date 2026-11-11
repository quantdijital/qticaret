import { defineConfig, devices } from "@playwright/test"
import { SESSION_FILE } from "./support/paths"

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:5174"
const isCI = Boolean(process.env["CI"])
// The panel the run starts listens where `baseURL` says (C12: a second copy
// on its own ports, `E2E_BASE_URL` + `CP_PANEL_BACKEND_URL`, beside the one in use)
const panelPort = new URL(baseURL).port || "5174"

/**
 * The control plane panel's e2e (adr/0061 C6): a temporary owner signs in
 * and sets 2FA up, every screen opens without an error at a desk and on a
 * phone, axe finds no serious issue in light or dark, and the step-up
 * dialog obtains a proof and retries. They run against the panel's dev
 * server (started here if it is not running) and a control plane that is:
 * `pnpm dev:cp-api`. Nothing they do writes data apart from the temporary
 * owner, which the teardown deletes. One worker: the machine is shared.
 */
export default defineConfig({
  testDir: ".",
  outputDir: "./.results",
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
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
      name: "desktop",
      testMatch: /\.e2e\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: SESSION_FILE,
      },
    },
    {
      name: "phone",
      testMatch: /(smoke|a11y)\.e2e\.ts$/,
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: SESSION_FILE },
    },
  ],
  webServer: {
    command: "pnpm dev",
    cwd: "..",
    env: { CP_PANEL_PORT: panelPort },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
