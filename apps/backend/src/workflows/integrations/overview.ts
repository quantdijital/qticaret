import type { MedusaContainer } from "@medusajs/framework/types"
import { providerFailureLog } from "../../lib/clients/failure-log"
import { errorSummary, logger } from "../../lib/logging"
import type { ProviderFailure } from "../../lib/clients/failure-log"
import { shopEmailTransport } from "../../lib/messaging/email/shop-transport"
import { SEARCH_CONSOLE_SCOPE, googleClientOf } from "../../lib/google/oauth"
import { unavailableProviders } from "../../lib/integrations/available"
import { bankTransferSettings } from "../../lib/payments/settings"
import { GOOGLE_MERCHANT_MODULE } from "../../modules/google-merchant"
import type GoogleMerchantModuleService from "../../modules/google-merchant/service"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import type { CredentialStatus } from "../../modules/integration-credentials/types"
import { MARKETING_FEEDS_MODULE } from "../../modules/marketing-feeds"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CASH_ON_DELIVERY } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type MarketingFeedsModuleService from "../../modules/marketing-feeds/service"
import { brandOf } from "../messaging/brand"
import { currentSenderDomain, resendDomains, senderAddress } from "../messaging/sender-domain"
import {
  accountRow,
  bankTransferRow,
  cashOnDeliveryRow,
  emailRow,
  feedsRow,
  googleRow,
} from "./overview-rules"
import type { IntegrationGroup, IntegrationRow } from "./overview-rules"

// The last errors each row shows; the log keeps twenty
const FAILURES_SHOWN = 5

export interface IntegrationView extends IntegrationRow {
  failures: ProviderFailure[]
}

const ACCOUNTS: [IntegrationGroup, CredentialStatus["provider"]][] = [
  ["payments", "paytr"],
  ["payments", "iyzico"],
  ["shipping", "aras"],
  ["shipping", "yurtici"],
  ["shipping", "dhlecommerce"],
  ["shipping", "surat"],
  ["shipping", "ptt"],
  ["messaging", "netgsm"],
  ["marketing", "meta"],
  ["marketing", "ga4"],
]

const text = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

/**
 * Every outside service the shop uses (F12.2, docs/06): where each stands,
 * why, and its last failed calls. Read from each one's own records; no
 * secret, no provider is called (the health report and "test" do that).
 */
export async function integrationOverview(container: MedusaContainer): Promise<IntegrationView[]> {
  const transport = await shopEmailTransport(container)
  const [accounts, bank, cod, domain, sender, token, brand, [sync]] = await Promise.all([
    container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .describeAll(),
    bankTransferSettings(container),
    container
      .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      .isFeatureEnabled(CASH_ON_DELIVERY),
    currentSenderDomain(container),
    senderAddress(container),
    container.resolve<MarketingFeedsModuleService>(MARKETING_FEEDS_MODULE).currentToken(),
    brandOf(container),
    container
      .resolve<GoogleMerchantModuleService>(GOOGLE_MERCHANT_MODULE)
      .listMerchantSyncs({}, { take: 1 }),
  ])
  const account = (provider: CredentialStatus["provider"]) => {
    const found = accounts.find((each) => each.provider === provider)
    if (!found) {
      throw new Error(`integration overview: no status for ${provider}`)
    }
    return found
  }
  const unavailable: string[] = unavailableProviders()
  const google = account("google")
  const scopes = text(google.settings?.["scopes"]) ?? ""

  const listed: (IntegrationRow | null)[] = [
    ...ACCOUNTS.filter(([group]) => group === "payments").map(([group, id]) =>
      accountRow(group, account(id))
    ),
    bankTransferRow(bank.enabled),
    cashOnDeliveryRow(cod),
    ...ACCOUNTS.filter(([group]) => group !== "payments").map(([group, id]) =>
      // Not offered where the platform has no app for it, unless one is stored (adr/0027 Ek 2026-11-26)
      unavailable.includes(id) && account(id).state === "not_configured"
        ? null
        : accountRow(group, account(id))
    ),
    emailRow({
      sending: transport !== null,
      // The shop's own mail server has no domain to verify here (adr/0036 Ek 2026-11-10)
      ownDomain: resendDomains() !== null && transport?.name !== "smtp",
      sender,
      domain: domain ? { status: domain.status } : null,
    }),
    googleRow({
      platform: googleClientOf() !== null,
      account: google,
      searchConsoleGranted: scopes.split(" ").includes(SEARCH_CONSOLE_SCOPE),
      site: text(google.settings?.["gsc_site"]),
      merchantId: text(google.settings?.["merchant_id"]),
      lastSyncFailed: sync !== undefined && (sync.failed > 0 || sync.error !== null),
    }),
    feedsRow(token !== null, brand.storefrontUrl !== null),
  ]
  // A service the platform has not opened is not offered (Google without its client)
  const rows = listed.filter((each): each is IntegrationRow => each !== null)
  const log = providerFailureLog()
  // The failures are a help, not the page: a slow or missing Redis (its first
  // command waits on the connection) leaves them out rather than the page
  const failuresOf = (id: string) =>
    log.recent(id, FAILURES_SHOWN).catch((error: unknown) => {
      logger.warn({ event: "integrations.failures_unread", err: errorSummary(error) })
      return []
    })
  return Promise.all(rows.map(async (each) => ({ ...each, failures: await failuresOf(each.id) })))
}
