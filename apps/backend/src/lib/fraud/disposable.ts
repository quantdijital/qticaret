/**
 * Throwaway mailbox services (F15.6, adr/0044 §3): an order from one adds
 * to its score, never stops it. The best known ones; lower case.
 */
const DISPOSABLE = new Set([
  "10minutemail.com",
  "burnermail.io",
  "discard.email",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "mailinator.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "minuteinbox.com",
  "moakt.com",
  "mohmal.com",
  "sharklasers.com",
  "spamgourmet.com",
  "temp-mail.org",
  "tempail.com",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? ""
  return DISPOSABLE.has(domain)
}
