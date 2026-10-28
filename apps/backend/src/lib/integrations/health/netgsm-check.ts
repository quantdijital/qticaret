import { netgsmAccountOf, netgsmApi } from "../../messaging/sms/netgsm"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * Netgsm with the shop's stored SMS account (adr/0036): its sender names,
 * a read the login decides. No account stored is `not_configured`.
 */
export function netgsmHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "netgsm",
    kind: "messaging",
    check: async (signal) => {
      const account = netgsmAccountOf(await readAccount())
      if (!account) {
        return { status: "not_configured" }
      }
      const result = await netgsmApi().checkAccount(account, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
