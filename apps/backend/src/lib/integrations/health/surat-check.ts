import { suratApi, suratCredentialsOf } from "../../shipping/surat"
import type { AccountDetails } from "../account-check"
import type { IntegrationHealthCheck } from "./health"

/**
 * Sürat Kargo with the shop's stored contract (docs/entegrasyonlar/
 * surat.md): a tracking query for a code nobody has, which the tracking
 * login decides. No account stored is `not_configured`.
 */
export function suratHealthCheck(
  readAccount: () => Promise<AccountDetails | null>
): IntegrationHealthCheck {
  return {
    id: "surat",
    kind: "shipping",
    check: async (signal) => {
      const credentials = suratCredentialsOf(await readAccount())
      if (!credentials) {
        return { status: "not_configured" }
      }
      const result = await suratApi().checkLogin(credentials, { signal })
      return result === "valid" ? { status: "ok" } : { status: "down", reason: "auth_failed" }
    },
  }
}
