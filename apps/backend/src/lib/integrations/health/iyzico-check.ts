import { iyzicoApi, iyzicoCredentialsOf } from "../../payments/iyzico"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * iyzico with the shop's stored account (adr/0027), at the address of its
 * mode: the installment table, a read that only a known key with a
 * matching signature gets. No account stored is `not_configured`.
 */
export function iyzicoHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "iyzico",
    kind: "payment",
    check: async (signal) => {
      const credentials = iyzicoCredentialsOf(await readAccount())
      if (!credentials) {
        return { status: "not_configured" }
      }
      const result = await iyzicoApi().checkCredentials(credentials, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
