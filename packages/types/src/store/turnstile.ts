/**
 * Cloudflare Turnstile at the risky gates (adr/0044 Ek 2026-11-24): what a
 * client sends and what the backend answers. The backend's own list is in
 * `apps/backend/src/lib/security/turnstile`; the names are the widget's
 * `action`, so a token made for one gate does not open another.
 */
export const TURNSTILE_GATES = [
  "login",
  "register",
  "password_reset",
  "checkout",
  "staff_login",
  "staff_password_reset",
  "order_lookup",
  "contact",
  "newsletter",
  "gift_card",
  "review",
  "question",
  "stock_alert",
] as const
export type TurnstileGate = (typeof TURNSTILE_GATES)[number]

/** The widget's token, one per request (it is spent once taken). */
export const TURNSTILE_TOKEN_HEADER = "x-turnstile-token"
/** The proof of work answered in Turnstile's stead while Cloudflare cannot answer: `<token>.<nonce>`. */
export const TURNSTILE_FALLBACK_HEADER = "x-turnstile-fallback"

/** The answer's `message` when the gate wants a token (428) or refused the one sent (403). */
export const TURNSTILE_REQUIRED = "fraud.turnstile_required"
export const TURNSTILE_FAILED = "fraud.turnstile_failed"
/** A 428 `fraud.challenge_required` with this `fallback` is Turnstile's stand-in, not the soft limit's. */
export const TURNSTILE_UNAVAILABLE = "turnstile_unavailable"

/** What a form is told to do about Turnstile: get a token for `action` (a 428), or a fresh one (a 403). */
export interface TurnstileAsk {
  action: string
  /** The token sent was refused (403): the shopper is told, the next send takes a fresh one. */
  failed: boolean
}

/** The widget's public key, from `GET /store/storefront` and the panel's `GET /admin/public-config`. */
export interface TurnstilePublic {
  /** null: no widget (a backend before it); the gates then answer as they would without a token. */
  site_key: string | null
}
