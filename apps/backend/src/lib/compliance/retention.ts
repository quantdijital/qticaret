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
  /** A visitor's cookie banner answers: their cookie lasts 13 months; the proof a while longer. */
  cookieConsent: 730,
  /** The IP address and browser in the audit log (adr/0011). */
  auditClient: 730,
  /** A stock alert once its notice went or it was cancelled; a guest's never confirmed. */
  stockAlert: 180,
  /** A double opt-in request after its link expired: the consent keeps its own proof. */
  consentRequest: 30,
} as const

const DAY_MS = 24 * 60 * 60 * 1000

/** The moment before which a record kept `days` is due. */
export const cutoffOf = (days: number, now: Date): Date => new Date(now.getTime() - days * DAY_MS)
