import { isProviderError } from "../errors"
import type { ProviderErrorShape } from "../errors"
import { errorSummary, logger } from "../logging"
import type { CredentialProviderName } from "../../modules/integration-credentials/providers"
import { iyzicoApi, iyzicoCredentialsOf } from "../payments/iyzico"
import { paytrApi, paytrCredentialsOf } from "../payments/paytr"
import { arasApi, arasCredentialsOf } from "../shipping/aras"
import { geliverApi, geliverCredentialsOf } from "../shipping/geliver"
import { netgsmAccountOf, netgsmApi } from "../messaging/sms/netgsm"
import { yurticiApi, yurticiCredentialsOf } from "../shipping/yurtici"
import { conversionsApi, metaAccountOf } from "../conversions/client"
import { googleApi } from "../google/client"
import { googleClientOf } from "../google/oauth"
import { checkShopify, shopifyCredentialsOf } from "../migration/shopify/client"
import { checkSmtp } from "../messaging/email/smtp-check"
import { aiAccountChecker } from "../ai/account-check"

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
  aras: async (account, signal) => {
    const credentials = arasCredentialsOf(account)
    return credentials ? arasApi().checkCredentials(credentials, { signal }) : "secret_invalid"
  },
  // The shop's login, then its door account when it gave one: `merchant_invalid` is that one
  yurtici: async (account, signal) => {
    const credentials = yurticiCredentialsOf(account)
    if (!credentials) {
      return "secret_invalid"
    }
    const api = yurticiApi()
    if ((await api.checkLogin(credentials.main, credentials.testMode, { signal })) !== "valid") {
      return "secret_invalid"
    }
    return credentials.cod &&
      (await api.checkLogin(credentials.cod, credentials.testMode, { signal })) !== "valid"
      ? "merchant_invalid"
      : "valid"
  },
  // `merchant_invalid`: the login works, the sender name is not on it
  netgsm: async (account, signal) => {
    const credentials = netgsmAccountOf(account)
    return credentials ? netgsmApi().checkAccount(credentials, { signal }) : "secret_invalid"
  },
  // `secret_invalid`: Google no longer takes the refresh token; `merchant_invalid`:
  // the account cannot reach the Merchant Center account the shop named
  google: async (account) => {
    const client = googleClientOf()
    const refreshToken = account.secrets["refresh_token"]
    if (!client || !refreshToken) {
      return "secret_invalid"
    }
    const api = googleApi()
    let token: string
    try {
      token = await api.accessToken(client, refreshToken)
    } catch (error) {
      if (isProviderError(error) && error.providerCode === "invalid_grant") {
        return "secret_invalid"
      }
      throw error
    }
    const merchantId = account.settings["merchant_id"]
    if (typeof merchantId !== "string") {
      return "valid"
    }
    try {
      await api.readAccount(token, merchantId)
      return "valid"
    } catch (error) {
      if (
        isProviderError(error) &&
        ["PERMISSION_DENIED", "NOT_FOUND", "http_403", "http_404"].includes(error.providerCode)
      ) {
        return "merchant_invalid"
      }
      throw error
    }
  },
  // Meta's code 190: a token it does not take; 100: a pixel it does not know or the token cannot reach
  meta: async (account, signal) => {
    const credentials = metaAccountOf(account)
    if (!credentials) {
      return "secret_invalid"
    }
    try {
      await conversionsApi().readPixel(credentials, signal)
      return "valid"
    } catch (error) {
      if (isProviderError(error) && error.providerCode === "meta_190") {
        return "secret_invalid"
      }
      if (isProviderError(error) && error.providerCode === "meta_100") {
        return "merchant_invalid"
      }
      throw error
    }
  },
  // GA4 answers every Measurement Protocol request alike: nothing to ask it,
  // only the form was checked
  ga4: () => Promise.resolve("valid"),
  // F14: a day's token for the store, then its name
  shopify: async (account, signal) => {
    const credentials = shopifyCredentialsOf(account)
    return credentials ? checkShopify(credentials, signal) : "secret_invalid"
  },
  // adr/0036 Ek 2026-11-10: a sign-in, nothing sent. `secret_invalid`: the login refused;
  // `merchant_invalid`: no TLS the server and we agree on
  smtp: (account, signal) => checkSmtp(account, signal),
  // adr/0071 §3: the model list, nothing generated (lib/ai/account-check.ts)
  deepseek: aiAccountChecker("deepseek"),
  minimax: aiAccountChecker("minimax"),
  gemini: aiAccountChecker("gemini"),
  fake: aiAccountChecker("fake"),
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
  // A refused login is the user name or the password; the panel points at the password
  aras: { merchant_invalid: "secrets.username", secret_invalid: "secrets.password" },
  // The main login, or the door account's (see its checker)
  yurtici: { merchant_invalid: "secrets.cod_password", secret_invalid: "secrets.password" },
  netgsm: { merchant_invalid: "settings.msgheader", secret_invalid: "secrets.password" },
  google: { merchant_invalid: "settings.merchant_id", secret_invalid: "secrets.refresh_token" },
  meta: { merchant_invalid: "settings.pixel_id", secret_invalid: "secrets.access_token" },
  ga4: { merchant_invalid: "settings.measurement_id", secret_invalid: "secrets.api_secret" },
  // Another organization's store is the domain's; a refused token, the secret
  shopify: { merchant_invalid: "settings.shop_domain", secret_invalid: "secrets.client_secret" },
  smtp: { merchant_invalid: "settings.security", secret_invalid: "secrets.password" },
  // One key: whatever an AI service refuses is the key
  deepseek: { merchant_invalid: "secrets.api_key", secret_invalid: "secrets.api_key" },
  minimax: { merchant_invalid: "secrets.api_key", secret_invalid: "secrets.api_key" },
  gemini: { merchant_invalid: "secrets.api_key", secret_invalid: "secrets.api_key" },
  fake: { merchant_invalid: "secrets.api_key", secret_invalid: "secrets.api_key" },
} satisfies Record<CredentialProviderName, Record<"merchant_invalid" | "secret_invalid", string>>
