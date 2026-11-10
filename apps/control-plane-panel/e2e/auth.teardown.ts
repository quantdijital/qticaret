import { existsSync, readFileSync, rmSync } from "node:fs"
import { test as teardown } from "@playwright/test"
import { removeTemporaryOwner } from "./support/owner"
import { AUTH_DIR, OWNER_FILE } from "./support/paths"

// Removing the owner runs a script through Medusa's CLI, which boots the control plane
const CLI_TIMEOUT_MS = 120_000

/** The run's owner goes with the run, its session and recovery codes with it. */
teardown("removes the temporary owner", () => {
  teardown.setTimeout(CLI_TIMEOUT_MS)
  try {
    if (existsSync(OWNER_FILE)) {
      const { email } = JSON.parse(readFileSync(OWNER_FILE, "utf8")) as { email: string }
      removeTemporaryOwner(email)
    }
  } finally {
    rmSync(AUTH_DIR, { recursive: true, force: true })
  }
})
