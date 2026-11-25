import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { REPO_ROOT } from "./paths"

export interface TemporaryAdmin {
  email: string
  password: string
}

// Medusa's CLI in the backend, against its database (its `.env`). The local
// `.env` points providers at the fake servers, which the backend refuses
// unless NODE_ENV is development or test (an unset one counts as live).
const backend = (args: string[]) =>
  execFileSync("pnpm", ["--filter", "@qticaret/backend", "medusa", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, NODE_ENV: "development" },
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
  // `--password=`, joined: a password starting with "-" would read as an option
  try {
    backend(["user", `--email=${email}`, `--password=${password}`])
  } catch {
    // The thrown message carries the command line, password and all (the CI log is public)
    throw new Error("e2e: the temporary admin could not be created")
  }
  // The run checks every screen: it is the shop's owner (adr/0040)
  try {
    backend(["exec", "./src/scripts/set-staff-role.ts", email, "owner"])
  } catch (error) {
    // The setup has not yet written the file the teardown reads it from:
    // without a role the account goes here, or it would stay in the database
    try {
      removeTemporaryAdmin(email)
    } catch (removal) {
      // Its own message already says why, without the CLI's piped output
      throw new Error(`e2e: the temporary admin got no role and stays (${email})`, {
        cause: removal,
      })
    }
    throw error
  }
  return { email, password }
}

/** The run's admin removed with its login: a user cannot delete itself through the API. */
export function removeTemporaryAdmin(email: string): void {
  try {
    backend(["exec", "./src/scripts/remove-e2e-admin.ts", email])
  } catch (error) {
    // The CLI's output stays piped (the CI log is public); only the script's own
    // refusal or a staff error code (`staff.last_owner`) is passed on, so a failure says why
    const piped = (error as { stderr?: Buffer | string | null }).stderr
    const stderr = piped ? piped.toString() : ""
    const reasons = stderr.match(/remove-e2e-admin: [^\n]+|staff\.[a-z_]+/g)
    // eslint-disable-next-line preserve-caught-error -- its cause would carry the whole piped output into the public report
    throw new Error(`removing the e2e admin failed: ${reasons?.join("; ") ?? "no reason given"}`)
  }
}
