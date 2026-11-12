import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { REPO_ROOT } from "./paths"

/**
 * A slug for a shop the e2e makes through the wizard, of the one shape the
 * control plane's `e2e-shop` script removes (apps/control-plane
 * src/scripts/e2e-shop.ts): nothing else is ever dropped.
 */
export const e2eSlug = () => `e2e-${String(Date.now())}-${randomBytes(3).toString("hex")}`

// Medusa's CLI in the control plane, against its database; the local
// provisioner stops the shop and drops what its setup made
const controlPlane = (args: string[]) =>
  execFileSync(
    "pnpm",
    ["--filter", "@qticaret/control-plane", "medusa", "exec", "./src/scripts/e2e-shop.ts", ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: "development", CP_PROVISIONER: "local" },
      stdio: "pipe",
    }
  )

/** The shop and everything its setup made, gone. */
export function removeE2eShop(slug: string): void {
  controlPlane(["remove", slug])
}

/**
 * A shop record of the e2e's slug shape that reports running `version`
 * (`commit`) now, set up nowhere (Ek C18: the version tab and the list's
 * drift without a real shop); removed as any e2e shop.
 */
export function makeReportingShop(slug: string, version: string, commit: string): void {
  controlPlane(["make", slug, version, commit])
}

/** Every shop an e2e run left behind, and every release it added (the teardown's sweep). */
export function removeAllE2eShops(): void {
  controlPlane(["remove-all"])
}
