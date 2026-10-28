import { arasApi, arasCredentialsOf } from "../../shipping/aras"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * Aras Kargo with the shop's stored contract (adr/0035): a read the
 * account's login decides. No account stored is `not_configured`.
 */
export function arasHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "aras",
    kind: "shipping",
    check: async (signal) => {
      const credentials = arasCredentialsOf(await readAccount())
      if (!credentials) {
        return { status: "not_configured" }
      }
      const result = await arasApi().checkCredentials(credentials, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
