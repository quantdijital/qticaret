import { defineConfig, devices, type ReporterDescription } from "@playwright/test"
import { SESSION_FILE } from "./support/paths"

const baseURL = process.env["E2E_BASE_URL"] ?? "http://localhost:5173"
const isCI = Boolean(process.env["CI"])
const CI_REPORTERS: ReporterDescription[] = [["github"]]

/**
 * The CI's two e2e jobs (adr/0081 Ek 2026-11-25), split by measured time,
 * not by count: group "1" is the files named here, group "2" every other
 * file, so a new file runs without being listed. Worker seconds when they
 * were chosen: a11y 410, scroll 145, dialogs 61 (616) against shell 276,
 * smoke 95, layout 90, phone 84 and the rest 17 (562). Unset: every file.
 */
const GROUP_ONE = /(a11y|scroll|dialogs)\.e2e\.ts$/
const EVERY_FILE = /\.e2e\.ts$/
function groupFiles(group: string | undefined): { testMatch: RegExp; testIgnore?: RegExp } {
  if (group === undefined || group === "") {
    return { testMatch: EVERY_FILE }
  }
  if (group === "1") {
    return { testMatch: GROUP_ONE }
  }
  if (group === "2") {
    return { testMatch: EVERY_FILE, testIgnore: GROUP_ONE }
  }
  // A typo must not pass as a green run of no tests
  throw new Error(`E2E_GROUP is "1", "2" or unset, not "${group}"`)
}

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
  // In CI, `list` beside `github`'s annotations: each test's time in the log,
  // what the two e2e shards are balanced by (adr/0081)
  reporter: [
    ...(isCI ? CI_REPORTERS : []),
    ["list"],
    ["html", { open: "never", outputFolder: "./.report" }],
  ],
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
      ...groupFiles(process.env["E2E_GROUP"]),
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
