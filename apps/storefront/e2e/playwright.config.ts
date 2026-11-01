import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:8000"
const isCI = Boolean(process.env["CI"])

/**
 * The storefront's e2e tests (docs/07, F18 D12): the pages open without
 * errors and with their security headers, axe finds no serious issue, and
 * a guest buys by bank transfer from the product page to the order page.
 * They run against the storefront's dev server (started here if it is not
 * running) and a backend that is, with the demo seed (`seed:demo`). The
 * order test writes an order to that database.
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
  projects: [{ name: "chromium", testMatch: /\.e2e\.ts$/, use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    cwd: "..",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
