import { geliverApi, geliverCredentialsOf } from "../../shipping/geliver"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * Geliver with the shop's stored account (adr/0031): one sender address
 * listed, a read that only a known token gets. No account stored is
 * `not_configured`.
 */
export function geliverHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "geliver",
    kind: "shipping",
    check: async (signal) => {
      const credentials = geliverCredentialsOf(await readAccount())
      if (!credentials) {
        return { status: "not_configured" }
      }
      const result = await geliverApi().checkCredentials(credentials, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
