import { pttApi, pttCredentialsOf } from "../../shipping/ptt"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * PTT Kargo with the shop's stored contract (docs/entegrasyonlar/ptt.md):
 * a tracking query for a barcode nobody has, which the account decides.
 * No account stored is `not_configured`.
 */
export function pttHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "ptt",
    kind: "shipping",
    check: async (signal) => {
      const credentials = pttCredentialsOf(await readAccount())
      if (!credentials) {
        return { status: "not_configured" }
      }
      const result = await pttApi().checkLogin(credentials, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
