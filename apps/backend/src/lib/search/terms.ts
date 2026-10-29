/**
 * A storefront search as the report keeps it (F11.8, adr/0039 §8): the
 * words, lower-cased the Turkish way, spaces collapsed. A search that may
 * hold a person (an e-mail, a phone or identity number, a long run of
 * digits, an address on the web) is not kept at all, nor one too short or
 * too long to be a product search.
 */

export const MAX_TERM_LENGTH = 60

const EMAIL = /[^\s@]+@[^\s@]+/
const URLISH = /(https?:\/\/|www\.)/i
// A phone, an identity or tax number, a card: six digits or more, spaces and dashes allowed
const LONG_DIGITS = /\d(?:[\s\-.()]*\d){5,}/

export function normalizeSearchTerm(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null
  }
  const term = raw.normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr")
  if (term.length < 2 || term.length > MAX_TERM_LENGTH) {
    return null
  }
  if (EMAIL.test(term) || URLISH.test(term) || LONG_DIGITS.test(term)) {
    return null
  }
  // Control and invisible characters: nothing a shopper types
  if (/[\p{Cc}\p{Cf}]/u.test(term)) {
    return null
  }
  return term
}
