import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { REPO_ROOT } from "./paths"

export interface TemporaryAdmin {
  email: string
  password: string
}

// Medusa's CLI in the backend, against its database (its `.env`)
const backend = (args: string[]) =>
  execFileSync("pnpm", ["--filter", "@qticaret/backend", "medusa", ...args], {
    cwd: REPO_ROOT,
    stdio: "pipe",
  })

/**
 * A fresh admin for one e2e run. Its password is random and never stored:
 * the run keeps only the session it signs in with. Nobody's own account
 * or browser profile is used.
 */
export function createTemporaryAdmin(): TemporaryAdmin {
  const email = `e2e-${String(Date.now())}-${randomBytes(3).toString("hex")}@example.com`
  const password = randomBytes(18).toString("base64url")
  backend(["user", "-e", email, "-p", password])
  return { email, password }
}

/** The run's admin removed with its login: a user cannot delete itself through the API. */
export function removeTemporaryAdmin(email: string): void {
  backend(["exec", "./src/scripts/remove-e2e-admin.ts", email])
}
