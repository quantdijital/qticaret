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

const BASE = "https://shop.invalid"

// Control characters, space, DEL and the backslash: a browser strips or turns them on the way
function hasUnsafeCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 0x20 || code === 0x7f || code === 0x5c) {
      return true
    }
  }
  return false
}

/**
 * A path on this shop to go to after signing in; anything else is
 * dropped: another host, `//x`, a backslash, or any control or space
 * character a browser would strip on the way (`/\t/evil` is `//evil`).
 * What comes back is the path the URL parser itself made of it.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.length > 300 || !next.startsWith("/") || hasUnsafeCharacter(next)) {
    return null
  }
  const url = URL.parse(next, BASE)
  if (url?.origin !== BASE) {
    return null
  }
  const path = `${url.pathname}${url.search}`
  return path.startsWith("//") ? null : path
}
