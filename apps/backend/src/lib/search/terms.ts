/**
 * A storefront search as the report keeps it (F11.8, adr/0039 §8): the
 * words, lower-cased the Turkish way, spaces collapsed. A search that may
 * hold a person (an e-mail, a phone or identity number, a long run of
 * digits, a plate, an address on the web) is not kept at all, nor one too
 * short or too long to be a product search. Compatibility forms are
 * folded first: fullwidth `１２３` and `＠` read as `123` and `@`.
 */

export const MAX_TERM_LENGTH = 60

// `ali@x`, `ali @ x.com`
const EMAIL = /[^\s@]+\s*@\s*[^\s@]+/
const URLISH = /(https?:\/\/|www\.)/i
// A phone, an identity or tax number, a card: six digits or more, in any
// script, whatever stands between them that is not a letter
const LONG_DIGITS = /\p{Nd}(?:[^\p{L}\p{Nd}]*\p{Nd}){5,}/u
// A Turkish plate: a province code (01–81), one to three letters, two to four digits
const PLATE = /(?<![\p{L}\p{Nd}])(0[1-9]|[1-7]\d|8[01])\s*[a-z]{1,3}\s*\d{2,4}(?![\p{L}\p{Nd}])/u

export function normalizeSearchTerm(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null
  }
  const term = raw.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr")
  if (term.length < 2 || term.length > MAX_TERM_LENGTH) {
    return null
  }
  if ([EMAIL, URLISH, LONG_DIGITS, PLATE].some((pattern) => pattern.test(term))) {
    return null
  }
  // Control and invisible characters: nothing a shopper types
  if (/[\p{Cc}\p{Cf}]/u.test(term)) {
    return null
  }
  return term
}
