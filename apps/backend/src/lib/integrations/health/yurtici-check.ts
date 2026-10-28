import { yurticiApi, yurticiCredentialsOf } from "../../shipping/yurtici"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * Yurtiçi Kargo with the shop's stored contract (adr/0035): a query the
 * main login decides. No account stored is `not_configured`.
 */
export function yurticiHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "yurtici",
    kind: "shipping",
    check: async (signal) => {
      const credentials = yurticiCredentialsOf(await readAccount())
      if (!credentials) {
        return { status: "not_configured" }
      }
      const result = await yurticiApi().checkLogin(credentials.main, credentials.testMode, {
        signal,
      })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
