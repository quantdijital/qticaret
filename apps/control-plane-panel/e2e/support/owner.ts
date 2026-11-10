import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { REPO_ROOT } from "./paths"

export interface TemporaryOwner {
  email: string
  password: string
}

// Medusa's CLI in the control plane, against its database (its `.env`);
// the script refuses anything but development and test, and any other address
const controlPlane = (args: string[]) =>
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@qticaret/control-plane",
      "medusa",
      "exec",
      "./src/scripts/e2e-owner.ts",
      ...args,
    ],
    { cwd: REPO_ROOT, env: { ...process.env, NODE_ENV: "development" }, stdio: "pipe" }
  )

/**
 * A fresh owner for one run (apps/control-plane src/scripts/e2e-owner.ts):
 * a random password, never stored beyond the run's own folder, no 2FA yet
 * (the setup sets it up through the panel). Nobody's own account is used.
 */
export function createTemporaryOwner(): TemporaryOwner {
  const email = `cp-e2e-${String(Date.now())}-${randomBytes(3).toString("hex")}@example.com`
  // Hex: a password starting with "-" would read as an option
  const password = randomBytes(24).toString("hex")
  controlPlane(["make", email, password])
  return { email, password }
}

/** The run's owner removed with its login and sessions. */
export function removeTemporaryOwner(email: string): void {
  controlPlane(["remove", email])
}
