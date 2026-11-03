import { passwordProblem } from "../../lib/security/password"

export const TEST_CUSTOMER_USAGE =
  "usage: NODE_ENV=development pnpm --filter @qticaret/backend customer:test <email> <password>"

// Enough of an address to sign in with; the store's own checks are Medusa's
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,63}$/

/**
 * The script's two arguments, checked; never the password in an error.
 * Refused outside development and test: a known password on a live shop
 * would be a back door (like `seed:demo-orders`).
 */
export function parseTestCustomerArgs(
  args: readonly string[],
  nodeEnv: string | undefined
): { email: string; password: string } {
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    throw new Error("customer:test: development and test databases only")
  }
  const [rawEmail, password, ...rest] = args
  const email = rawEmail?.trim().toLowerCase() ?? ""
  if (!EMAIL.test(email) || password === undefined || rest.length > 0) {
    throw new Error(TEST_CUSTOMER_USAGE)
  }
  // The shop's own rule for a new password (adr/0043), less the breach lookup
  const problem = passwordProblem(password, email)
  if (problem) {
    throw new Error(`customer:test: the password is refused (${problem})`)
  }
  return { email, password }
}
