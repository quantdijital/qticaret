import type { IyzicoCredentials } from "./types"

/**
 * The shop's iyzico account as the client takes it, from what the panel
 * stored (adr/0027: `test_mode` in the clear, both keys sealed). Null
 * when something is missing.
 */
export function iyzicoCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): IyzicoCredentials | null {
  const apiKey = account?.secrets["api_key"]
  const secretKey = account?.secrets["secret_key"]
  if (!apiKey || !secretKey) {
    return null
  }
  return { apiKey, secretKey, testMode: account.settings["test_mode"] === true }
}
