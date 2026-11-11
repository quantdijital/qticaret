import { existsSync, readFileSync, rmSync } from "node:fs"
import { test as teardown } from "@playwright/test"
import { removeTemporaryOwner } from "./support/owner"
import { AUTH_DIR, OWNER_FILE } from "./support/paths"
import { removeAllE2eShops } from "./support/shops"

// Removing the owner (and any e2e shop) runs scripts through Medusa's CLI, each booting the control plane
const CLI_TIMEOUT_MS = 240_000

/**
 * The run's owner goes with the run, its session and recovery codes with
 * it; so does any shop the run made through the wizard and left behind
 * (C11). A failed sweep still removes the owner, then fails the teardown.
 */
teardown("removes the temporary owner and the run's shops", () => {
  teardown.setTimeout(CLI_TIMEOUT_MS)
  let sweep: Error | null = null
  try {
    try {
      removeAllE2eShops()
    } catch (error) {
      sweep = error instanceof Error ? error : new Error(String(error))
    }
    if (existsSync(OWNER_FILE)) {
      const { email } = JSON.parse(readFileSync(OWNER_FILE, "utf8")) as { email: string }
      removeTemporaryOwner(email)
    }
  } finally {
    rmSync(AUTH_DIR, { recursive: true, force: true })
  }
  if (sweep) {
    throw sweep
  }
})
