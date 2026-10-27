import type { PaytrCredentials } from "./client"

/**
 * The shop's PayTR account as the client takes it, from what the panel
 * stored (adr/0027: `merchant_id` and `test_mode` in the clear, the key
 * and salt sealed). Null when something is missing.
 */
export function paytrCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): PaytrCredentials | null {
  const merchantId = account?.settings["merchant_id"]
  const merchantKey = account?.secrets["merchant_key"]
  const merchantSalt = account?.secrets["merchant_salt"]
  if (typeof merchantId !== "string" || !merchantKey || !merchantSalt) {
    return null
  }
  return {
    merchantId,
    merchantKey,
    merchantSalt,
    testMode: account.settings["test_mode"] === true,
  }
}
