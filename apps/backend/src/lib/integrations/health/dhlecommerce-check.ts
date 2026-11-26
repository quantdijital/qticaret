import { dhlEcomApi, dhlEcomAvailable, dhlEcomCredentialsOf } from "../../shipping/dhlecommerce"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * DHL eCommerce with the shop's stored contract (docs/entegrasyonlar/
 * dhlecommerce.md): a token the customer number and password get. No
 * account stored, or neither an app of the shop's own nor the platform's
 * on this server, is `not_configured`.
 */
export function dhlEcomHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "dhlecommerce",
    kind: "shipping",
    check: async (signal) => {
      const credentials = dhlEcomCredentialsOf(await readAccount())
      if (!credentials || (!credentials.app && !dhlEcomAvailable())) {
        return { status: "not_configured" }
      }
      const result = await dhlEcomApi().checkLogin(credentials, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
