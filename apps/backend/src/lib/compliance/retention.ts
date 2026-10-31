/**
 * How long personal data is kept where no law or contract keeps it longer
 * (F13.5, adr/0041 §6). One place for the periods the nightly
 * `compliance-retention` job applies; docs/kvkk-envanter.md lists them
 * beside the others. Proposals until the shop's KVKK adviser confirms
 * them (docs/12).
 */
export const RETENTION_DAYS = {
  /** A cart's consents and age declaration when it never became an order. */
  abandonedCart: 30,
  /** The cart itself, its e-mail and addresses, when it never became an order: since it was last touched. */
  abandonedCartContact: 90,
  /**
   * The GA client id after the shop's return window (added to it, from the
   * consent's day): the parcel's way back and the refund's GA4 event.
   */
  gaClientMargin: 45,
  /** The record of an e-mail or SMS sent, its recipient with it: as long as a consent's proof. */
  sentMessage: 1095,
  /** A visitor's cookie banner answers: their cookie lasts 13 months; the proof a while longer. */
  cookieConsent: 730,
  /** The IP address and browser in the audit log (adr/0011). */
  auditClient: 730,
  /** A stock alert once its notice went or it was cancelled; a guest's never confirmed. */
  stockAlert: 180,
  /** A double opt-in request after its link expired: the consent keeps its own proof. */
  consentRequest: 30,
  /**
   * An order's contract copy and the consent's IP address: kept this long
   * even when the customer asks to be erased (distance sales regulation).
   */
  contract: 1095,
} as const

/** The address an erased customer and their orders are left with: unique, deliverable nowhere. */
export const erasedEmail = (customerId: string): string =>
  `anonim-${customerId.toLowerCase()}@kvkk.invalid`

/** What an erased person's addresses keep: the place for the books, never the person. */
export const ERASED_ADDRESS = {
  first_name: "Anonim",
  last_name: null,
  company: null,
  address_1: null,
  address_2: null,
  postal_code: null,
  phone: null,
  metadata: null,
} as const

const DAY_MS = 24 * 60 * 60 * 1000

/** The moment before which a record kept `days` is due. */
export const cutoffOf = (days: number, now: Date): Date => new Date(now.getTime() - days * DAY_MS)
