import { isStoreApiError } from "../store-api/errors"

/** The backend's refusals a shopper can act on, by key; anything else is the form's own message. */
const KNOWN = new Set([
  "auth.password_too_short",
  "auth.password_too_long",
  "auth.password_common",
  "auth.password_contains_email",
  "auth.password_breached",
  "messaging.email_domain_refuses",
  "fraud.refused",
  "fraud.velocity",
  "errors.too_many_requests",
  "account.token_before_password_change",
])

export function accountError(error: unknown, fallback: string): string {
  if (!isStoreApiError(error)) {
    return fallback
  }
  if (error.status === 429) {
    return "errors.too_many_requests"
  }
  const key = error.messageKey ?? ""
  if (KNOWN.has(key)) {
    return key
  }
  // Medusa's own words for an address already registered
  if (error.status === 401 && /exist/i.test(key) && fallback === "account.register_failed") {
    return "account.email_taken"
  }
  if (key.startsWith("tr_address.phone")) {
    return "checkout.phone_invalid"
  }
  return fallback
}

/** A path on this shop to go to after signing in; anything else (another host, `//x`) is dropped. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return null
  }
  return next.length <= 300 ? next : null
}
