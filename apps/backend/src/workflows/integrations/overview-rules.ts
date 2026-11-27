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
  /** The address the shop's e-mail goes from, for the e-mail row's notes. */
  sender?: string
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

/**
 * Providers whose check can refuse details but never confirm them (PTT:
 * it answers a made-up account as it does a right one): "not verified"
 * is all they ever get, said as a note, not as something to fix.
 */
const NEVER_CONFIRMED: ReadonlySet<string> = new Set(["ptt"])

/** A provider account (adr/0027): its stored state, and its test mode where it has one. */
export function accountRow(group: IntegrationGroup, status: CredentialStatus): IntegrationRow {
  const testMode = status.settings?.["test_mode"] === true
  const modeNotes = testMode ? [{ code: "test_mode" }] : []
  switch (status.state) {
    case "not_configured":
      return row(status.provider, group, "not_set_up")
    case "connected":
      return row(status.provider, group, "connected", modeNotes, "account")
    case "unverified":
      return NEVER_CONFIRMED.has(status.provider)
        ? row(
            status.provider,
            group,
            "connected",
            [...modeNotes, { code: "unconfirmed" }],
            "account"
          )
        : row(status.provider, group, "attention", [{ code: status.state }], "account")
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

/**
 * Google: one account for Search Console and Merchant Center. None until
 * the platform's client is set: the shop can do nothing with a service the
 * platform has not opened (docs/06 principle 10), so it is not offered.
 */
export function googleRow(facts: GoogleFacts): IntegrationRow | null {
  if (!facts.platform) {
    return null
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
  /** The platform's transport sends the shop's e-mail, and from an address (adr/0036). */
  sending: boolean
  /** The shop can verify its own domain there (Resend's domains; not a developer's mailbox). */
  ownDomain: boolean
  /** Who the e-mail is from now: the shop's verified domain, else the platform's address. */
  sender: string | null
  domain: { status: string } | null
}

/**
 * E-mail, as the shop sees it: whether its e-mails go out, and from which
 * address. Its own domain is offered only where the shop can verify one,
 * and while one waits on its DNS that is the shop's to act on. Nothing
 * sending is the platform's setting (logged for the operator where the
 * transport is resolved): the shop is told only that, in one line.
 */
export function emailRow({ sending, ownDomain, sender, domain }: EmailFacts): IntegrationRow {
  if (!sending || sender === null) {
    return row("resend", "messaging", "off", [{ code: "not_sending" }])
  }
  if (!ownDomain) {
    return row("resend", "messaging", "connected", [{ code: "sending", sender }])
  }
  if (!domain) {
    return row("resend", "messaging", "connected", [{ code: "platform_sender", sender }])
  }
  return domain.status === "verified"
    ? row("resend", "messaging", "connected", [{ code: "sending", sender }])
    : row("resend", "messaging", "attention", [
        { code: "sending", sender },
        { code: "domain_unverified" },
      ])
}

export function feedsRow(enabled: boolean, storefrontSet: boolean): IntegrationRow {
  if (!enabled) {
    return row("feeds", "marketing", "off")
  }
  return storefrontSet
    ? row("feeds", "marketing", "connected")
    : row("feeds", "marketing", "attention", [{ code: "no_storefront" }])
}
