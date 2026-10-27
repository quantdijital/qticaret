import type { GeliverCredentials } from "./types"

/**
 * The shop's Geliver account as the client takes it, from what the panel
 * stored (adr/0027: `test_mode` in the clear, the API token sealed). Null
 * when the token is missing.
 */
export function geliverCredentialsOf(
  account: { settings: Record<string, unknown>; secrets: Record<string, string> } | null
): GeliverCredentials | null {
  const token = account?.secrets["api_token"]
  return token ? { token, testMode: account.settings["test_mode"] === true } : null
}
