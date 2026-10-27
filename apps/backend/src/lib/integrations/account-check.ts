import { isProviderError } from "../errors"
import type { ProviderErrorShape } from "../errors"
import { errorSummary, logger } from "../logging"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import { iyzicoApi, iyzicoCredentialsOf } from "../payments/iyzico"
import { paytrApi, paytrCredentialsOf } from "../payments/paytr"
import { geliverApi, geliverCredentialsOf } from "../shipping/geliver"

/**
 * Asks a provider whether the shop's account details work (adr/0027 §4).
 * - `unreachable`: the network, a timeout, a 5xx or an open circuit; no
 *   verdict on the details, which may be saved as not checked yet.
 * - `failed`: the provider answered, but not as documented; nothing is saved.
 */

export type AccountCheck =
  "valid" | "merchant_invalid" | "secret_invalid" | "unreachable" | "failed"

/** Failures that say nothing about the details: the provider was not heard from. */
const notReached = (error: ProviderErrorShape): boolean =>
  error.retryable ||
  ["outcome_unknown", "circuit_open", "network_error", "aborted"].includes(error.providerCode) ||
  /^http_5\d\d$/.test(error.providerCode)

export interface AccountDetails {
  settings: Record<string, unknown>
  secrets: Record<string, string>
}

// A person waits at the panel: the provider gets this long, not the client's three tries
const CHECK_TIMEOUT_MS = 8_000

type Checker = (account: AccountDetails, signal: AbortSignal) => Promise<AccountCheck>

// One per connectable provider: a provider added without its check fails to compile
const CHECKERS = {
  paytr: async (account, signal) => {
    const credentials = paytrCredentialsOf(account)
    return credentials ? paytrApi().checkCredentials(credentials, { signal }) : "merchant_invalid"
  },
  iyzico: async (account, signal) => {
    const credentials = iyzicoCredentialsOf(account)
    return credentials ? iyzicoApi().checkCredentials(credentials, { signal }) : "merchant_invalid"
  },
  geliver: async (account, signal) => {
    const credentials = geliverCredentialsOf(account)
    return credentials ? geliverApi().checkCredentials(credentials, { signal }) : "secret_invalid"
  },
} satisfies Record<CredentialProviderName, Checker>

export async function checkAccount(
  provider: CredentialProviderName,
  account: AccountDetails,
  signal: AbortSignal = AbortSignal.timeout(CHECK_TIMEOUT_MS)
): Promise<AccountCheck> {
  try {
    return await CHECKERS[provider](account, signal)
  } catch (error) {
    if (!isProviderError(error)) {
      throw error
    }
    logger.warn({ event: "integrations.account_check_failed", provider, err: errorSummary(error) })
    return notReached(error) ? "unreachable" : "failed"
  }
}

/** Which field the panel points at when a check refuses the details. */
export const CHECK_FIELDS = {
  paytr: { merchant_invalid: "settings.merchant_id", secret_invalid: "secrets.merchant_key" },
  iyzico: { merchant_invalid: "secrets.api_key", secret_invalid: "secrets.secret_key" },
  // One token: whatever Geliver refuses is the token
  geliver: { merchant_invalid: "secrets.api_token", secret_invalid: "secrets.api_token" },
} satisfies Record<CredentialProviderName, Record<"merchant_invalid" | "secret_invalid", string>>
