import type { CredentialStatus } from "../../modules/integration-credentials/types"

/**
 * What the Integrations page says of each service (F12.2): where it stands
 * and why, in codes the panel words. Pure, from what `overview.ts` reads.
 */

/**
 * Only services the shop uses: no accounting program until one is written
 * (adr/0039 §5), nothing of the platform's own (its cache answers to
 * operations, not to the shop).
 */
export type IntegrationGroup = "payments" | "shipping" | "messaging" | "marketing"

/**
 * - `connected`: set up and, as far as is known, working
 * - `attention`: set up, but something needs the shop (a rejected account, a domain not verified)
 * - `not_set_up`: never set up
 * - `off`: set up or not, turned off by the shop or not offered here
 */
export type IntegrationState = "connected" | "attention" | "not_set_up" | "off"

export interface IntegrationNote {
  code: string
  count?: number
}

export interface IntegrationRow {
  id: string
  group: IntegrationGroup
  state: IntegrationState
  notes: IntegrationNote[]
  /** `account`: "test the connection" asks the provider with the stored account. */
  test: "account" | null
}

const row = (
  id: string,
  group: IntegrationGroup,
  state: IntegrationState,
  notes: IntegrationNote[] = [],
  test: IntegrationRow["test"] = null
): IntegrationRow => ({ id, group, state, notes, test })

/** A provider account (adr/0027): its stored state, and its test mode where it has one. */
export function accountRow(group: IntegrationGroup, status: CredentialStatus): IntegrationRow {
  const testMode = status.settings?.["test_mode"] === true
  switch (status.state) {
    case "not_configured":
      return row(status.provider, group, "not_set_up")
    case "connected":
      return row(
        status.provider,
        group,
        "connected",
        testMode ? [{ code: "test_mode" }] : [],
        "account"
      )
    case "unverified":
    case "rejected":
    case "unreadable":
      return row(status.provider, group, "attention", [{ code: status.state }], "account")
  }
}

export interface GoogleFacts {
  /** The platform's Google client exists (adr/0038 M13). */
  platform: boolean
  account: CredentialStatus
  searchConsoleGranted: boolean
  site: string | null
  merchantId: string | null
  lastSyncFailed: boolean
}

/** Google: one account for Search Console and Merchant Center. */
export function googleRow(facts: GoogleFacts): IntegrationRow {
  if (!facts.platform) {
    return row("google", "marketing", "off", [{ code: "platform_not_ready" }])
  }
  const base = accountRow("marketing", facts.account)
  if (base.state === "not_set_up") {
    return base
  }
  const notes: IntegrationNote[] = [
    ...base.notes,
    ...(facts.searchConsoleGranted
      ? facts.site
        ? []
        : [{ code: "search_console_no_site" }]
      : [{ code: "search_console_not_granted" }]),
    ...(facts.merchantId ? [] : [{ code: "merchant_not_chosen" }]),
    ...(facts.lastSyncFailed ? [{ code: "merchant_sync_failed" }] : []),
  ]
  const needsShop = notes.some((note) =>
    ["merchant_sync_failed", "rejected", "unverified", "unreadable"].includes(note.code)
  )
  return { ...base, state: needsShop ? "attention" : base.state, notes }
}

export function bankTransferRow(enabled: boolean): IntegrationRow {
  // Turning it on asks for the account (bank_transfer.incomplete): on is complete
  return row("bank_transfer", "payments", enabled ? "connected" : "off")
}

export function cashOnDeliveryRow(enabled: boolean): IntegrationRow {
  return row("cash_on_delivery", "payments", enabled ? "connected" : "off")
}

export interface EmailFacts {
  transport: "resend" | "mailpit" | null
  domain: { status: string } | null
}

/**
 * E-mail: Resend in production; the shop's own domain once verified, else
 * the platform's. Anything else (none, or a developer's local mailbox)
 * sends the shop nothing, and says so in the shop's words.
 */
export function emailRow({ transport, domain }: EmailFacts): IntegrationRow {
  if (transport !== "resend") {
    return row("resend", "messaging", "off", [{ code: "not_sending" }])
  }
  if (!domain) {
    return row("resend", "messaging", "connected", [{ code: "platform_sender" }])
  }
  return domain.status === "verified"
    ? row("resend", "messaging", "connected")
    : row("resend", "messaging", "attention", [{ code: "domain_unverified" }])
}

export function feedsRow(enabled: boolean, storefrontSet: boolean): IntegrationRow {
  if (!enabled) {
    return row("feeds", "marketing", "off")
  }
  return storefrontSet
    ? row("feeds", "marketing", "connected")
    : row("feeds", "marketing", "attention", [{ code: "no_storefront" }])
}
