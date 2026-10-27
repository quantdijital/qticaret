import { paytrApi, paytrCredentialsOf } from "../../payments/paytr"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * PayTR with the shop's stored account (adr/0027): a status query for an
 * order that cannot exist answers "not found" only to a valid account.
 * No account stored is `not_configured`, not a failure.
 */
export function paytrHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "paytr",
    kind: "payment",
    check: async (signal) => {
      const credentials = paytrCredentialsOf(await readAccount())
      if (!credentials) {
        return { status: "not_configured" }
      }
      const result = await paytrApi().checkCredentials(credentials, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
