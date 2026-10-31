/**
 * The shop's `/.well-known/security.txt` (RFC 9116; F15.9, docs/04): where
 * to report a security issue. One contact or more (a `mailto:` or an
 * `https:` address), an expiry a little under a year ahead (the RFC asks
 * for less than one), the languages read and, when known, the policy and
 * the file's own canonical address. Null without a contact: nothing to say.
 */

const CONTACT = /^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/
const DAY_MS = 24 * 60 * 60 * 1000
const VALID_DAYS = 180

export interface SecurityTxtInput {
  /** Comma separated, as the environment gives it. */
  contacts: string | undefined
  policyUrl: string | undefined
  canonicalHost: string | null
  now?: Date
}

export function securityTxt(input: SecurityTxtInput): string | null {
  const contacts = (input.contacts ?? "")
    .split(",")
    .map((contact) => contact.trim())
    .filter((contact) => CONTACT.test(contact))
  if (contacts.length === 0) {
    return null
  }
  const now = input.now ?? new Date()
  // Midnight UTC, so every instance of the shop answers the same file all day
  const expires = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS + VALID_DAYS * DAY_MS)
  const lines = [
    ...contacts.map((contact) => `Contact: ${contact}`),
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: tr, en",
    ...(input.policyUrl && /^https:\/\/\S+$/.test(input.policyUrl)
      ? [`Policy: ${input.policyUrl}`]
      : []),
    ...(input.canonicalHost
      ? [`Canonical: https://${input.canonicalHost}/.well-known/security.txt`]
      : []),
  ]
  return `${lines.join("\n")}\n`
}
