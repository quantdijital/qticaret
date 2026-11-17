import type { ConsentStatus } from "../../modules/messaging/types"

/** A cart is left behind once untouched this long (2026-11-06). */
export const ABANDONED_AFTER_MS = 60 * 60 * 1000
/** And shown for this long; older ones are past following up (and leave at 90 days, KVKK). */
export const ABANDONED_WINDOW_DAYS = 30

/** Why "E-posta ile hatırlat" is off for a cart, as the panel says it. */
export type EmailReminderBlock =
  | "no_email"
  | "wholesale"
  | "reminded"
  | "no_consent"
  | "suppressed"
  | "reminded_lately"
  | "no_storefront"

export interface EmailReminderFacts {
  email: string | null
  /** The shopper is an active wholesaler: no marketing (ADR-0068 decision 16). */
  wholesale: boolean
  consent: ConsentStatus | null
  suppressed: boolean
  /** The cart has had its one reminder (sent, or used up without consent). */
  reminded: boolean
  /** Another cart of the address was reminded within the week (the job's rule). */
  remindedLately: boolean
  /** The shop has a storefront domain for the reminder's link. */
  storefront: boolean
}

/**
 * Whether staff may send the cart's reminder by e-mail, and if not why.
 * A cart reminder is a commercial message (İYS): only to an address that
 * consented and is not suppressed; once a cart, and once a week an
 * address, as the job sends it; never to a wholesaler, whose cart it
 * would show at retail.
 */
export function emailReminderBlock(facts: EmailReminderFacts): EmailReminderBlock | null {
  if (!facts.email) {
    return "no_email"
  }
  if (facts.wholesale) {
    return "wholesale"
  }
  if (facts.reminded) {
    return "reminded"
  }
  if (facts.consent !== "granted") {
    return "no_consent"
  }
  if (facts.suppressed) {
    return "suppressed"
  }
  if (facts.remindedLately) {
    return "reminded_lately"
  }
  return facts.storefront ? null : "no_storefront"
}

const MOBILE = /^\+905\d{9}$/

/**
 * The number "WhatsApp'tan yaz" opens a chat with (wa.me's digits, no +),
 * or null: a Turkish mobile only (WhatsApp is on phones), whose owner
 * consented to commercial messages (İYS counts WhatsApp as MESAJ, the SMS
 * consent) and has not asked for none.
 */
export function whatsappNumber(
  phone: string | null,
  consent: ConsentStatus | null,
  suppressed: boolean
): string | null {
  if (!phone || !MOBILE.test(phone) || consent !== "granted" || suppressed) {
    return null
  }
  return phone.slice(1)
}

export interface ConsentPair {
  email: ConsentStatus | null
  sms: ConsentStatus | null
}

export interface AbandonedCartLine {
  title: string
  variant: string | null
  quantity: number
  thumbnail: string | null
}

/** A cart left behind as the panel's list shows it (2026-11-06). */
export interface AbandonedCartRow {
  id: string
  name: string | null
  email: string | null
  /** Masked in the list (docs/04); the dialog, a recorded read, has it whole. */
  phone_masked: string | null
  customer: { id: string; has_account: boolean } | null
  lines: AbandonedCartLine[]
  line_count: number
  total: number
  currency_code: string
  updated_at: string
  /** The cart's one reminder: what it came to, when; null when none was tried. */
  reminder: { outcome: string; at: string; returned: boolean } | null
  consent: ConsentPair
}

/** The cart in its window: the phone whole, and what staff may do. */
export interface AbandonedCartDetail extends AbandonedCartRow {
  phone: string | null
  actions: {
    /** Null: "E-posta ile hatırlat" may be pressed; otherwise why not. */
    email_block: EmailReminderBlock | null
    /** wa.me's digits, or null: no chat offered. */
    whatsapp: string | null
  }
}
