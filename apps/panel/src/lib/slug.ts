/**
 * A preview of the URL a product or category will get (docs/13 §2.1).
 * Mirrors apps/backend/src/lib/seo/slug.ts, which has the last word: the
 * server makes the handle when the form leaves it empty and refuses one
 * that is not a slug.
 */

export const SLUG_MAX_LENGTH = 80

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
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HAS_LETTER = /[a-z]/

function cutAtWord(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) {
    return slug
  }
  const cut = slug.slice(0, maxLength)
  const lastHyphen = cut.lastIndexOf("-")
  const atWord = slug[maxLength] === "-" || lastHyphen === -1 ? cut : cut.slice(0, lastHyphen)
  return (HAS_LETTER.test(atWord) ? atWord : cut).replace(/-+$/, "")
}

/** "Şef Bıçağı 20 cm" → "sef-bicagi-20-cm"; "" when no letter is left. */
export function toSlug(input: string, maxLength: number = SLUG_MAX_LENGTH): string {
  const ascii = Array.from(input.normalize("NFC"), (char) => TRANSLITERATION[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
  const slug = cutAtWord(ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), maxLength)
  return HAS_LETTER.test(slug) ? slug : ""
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= SLUG_MAX_LENGTH && SLUG.test(slug) && HAS_LETTER.test(slug)
}
