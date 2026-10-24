/**
 * URL slugs (docs/13 §2.1): Turkish letters transliterated, lowercase ASCII
 * letters, digits and single hyphens, at most 80 characters cut at a word
 * boundary. Numbers ("20-cm") and stop words stay. Product, category and
 * collection handles come from here (F3.1): Medusa's own `toHandle` keeps
 * Turkish letters (`şef-bıçağı`).
 */

export const SLUG_MAX_LENGTH = 80

// One slug segment: lowercase ASCII words joined by single hyphens
export const SLUG_SEGMENT = "[a-z0-9]+(?:-[a-z0-9]+)*"

// Letters that do not decompose into an ASCII base: Turkish ı (and İ, whose
// dot would otherwise become a mark), and a few Latin letters of their own
const TRANSLITERATION: Readonly<Record<string, string>> = {
  ı: "i",
  İ: "i",
  ß: "ss",
  æ: "ae",
  Æ: "ae",
  œ: "oe",
  Œ: "oe",
  ø: "o",
  Ø: "o",
  ł: "l",
  Ł: "l",
  đ: "d",
  Đ: "d",
  ð: "d",
  þ: "th",
  Þ: "th",
}

const SLUG = new RegExp(`^${SLUG_SEGMENT}$`)
const HAS_LETTER = /[a-z]/

function cutAtWord(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) {
    return slug
  }
  const cut = slug.slice(0, maxLength)
  // Cutting inside a word goes back to the previous hyphen, unless that
  // would leave no letter (a leading number) or there is none
  const lastHyphen = cut.lastIndexOf("-")
  const atWord = slug[maxLength] === "-" || lastHyphen === -1 ? cut : cut.slice(0, lastHyphen)
  const kept = HAS_LETTER.test(atWord) ? atWord : cut
  return kept.replace(/-+$/, "")
}

/**
 * A slug for `input`, or "" when no letter is left (emoji, punctuation or
 * digits only): a slug made of digits alone is an ID-like URL docs/13
 * forbids, so the caller picks another source text.
 */
export function toSlug(input: string, maxLength: number = SLUG_MAX_LENGTH): string {
  const ascii = Array.from(input.normalize("NFC"), (char) => TRANSLITERATION[char] ?? char)
    .join("")
    // Compatibility decomposition also splits ligatures (ﬁ), full-width
    // letters and superscripts (²); then accents go (ç → c, é → e)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
  const slug = cutAtWord(ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), maxLength)
  return HAS_LETTER.test(slug) ? slug : ""
}

/** P-SLUG-01 (docs/14): the allowed characters, the length limit, and not digits only. */
export function isValidSlug(slug: string): boolean {
  return slug.length <= SLUG_MAX_LENGTH && SLUG.test(slug) && HAS_LETTER.test(slug)
}
