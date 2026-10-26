import { existsSync, readFileSync, rmSync } from "node:fs"
import { test as teardown } from "@playwright/test"
import { removeTemporaryAdmin } from "./support/admin"
import { ADMIN_FILE, AUTH_DIR } from "./support/paths"

/** The run's admin goes with the run, and its session file with it. */
teardown("removes the temporary admin", () => {
  try {
    if (existsSync(ADMIN_FILE)) {
      const { email } = JSON.parse(readFileSync(ADMIN_FILE, "utf8")) as { email: string }
      removeTemporaryAdmin(email)
    }
  } finally {
    rmSync(AUTH_DIR, { recursive: true, force: true })
  }
})
