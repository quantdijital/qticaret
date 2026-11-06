import { ValidationError } from "../errors"

/**
 * Title and meta templates (docs/13 §3): tenant-defined text with tokens
 * such as `{ürün_adı} | {marka} | {mağaza}`. Templates are checked when
 * saved, so an unknown token is refused then rather than printed on a page;
 * a token without a value disappears together with the separator it leaves.
 */

/** Tokens per entity type (docs/13 §3), shared by the settings check (F2.3) and rendering (F3). */
export const SEO_TEMPLATE_TOKENS = {
  product: [
    "ürün_adı",
    "marka",
    "mağaza",
    "kategori",
    "öne_çıkan_attribute",
    "kısa_açıklama",
    "fiyat_cümlesi",
    "kargo_cümlesi",
  ],
  category: ["kategori", "mağaza"],
  brand: ["marka", "mağaza"],
  // F3.16: content pages and blog posts
  page: ["başlık", "mağaza"],
  post: ["başlık", "mağaza"],
  landing: ["başlık", "kategori", "mağaza"],
} as const

const TOKEN = /\{([^{}]*)\}/gu
const TOKEN_NAME = /^[\p{L}\p{N}_]+$/u
// A value longer than any title or description needs is cut before tidying
const MAX_VALUE_LENGTH = 1000

export interface TemplateCheck {
  unknownTokens: string[]
  /** Braces that do not form `{name}`. */
  isMalformed: boolean
}

export function checkTemplate(template: string, allowedTokens: readonly string[]): TemplateCheck {
  const text = template.normalize("NFC")
  const unknown = new Set<string>()
  let isMalformed = false
  for (const [, name = ""] of text.matchAll(TOKEN)) {
    if (!TOKEN_NAME.test(name)) {
      isMalformed = true
    } else if (!allowedTokens.includes(name)) {
      unknown.add(name)
    }
  }
  // A brace left over once every `{...}` is removed is unbalanced
  if (/[{}]/u.test(text.replace(TOKEN, ""))) {
    isMalformed = true
  }
  return { unknownTokens: [...unknown], isMalformed }
}

/** Throws `ValidationError` (`seo.template_invalid`) for `field` unless every token is allowed. */
export function assertValidTemplate(
  template: string,
  allowedTokens: readonly string[],
  field = "template"
): void {
  const { unknownTokens, isMalformed } = checkTemplate(template, allowedTokens)
  if (isMalformed || unknownTokens.length > 0) {
    throw new ValidationError("seo.template_invalid", { field })
  }
}

// Joiners only make sense between two pieces of text; when an empty token
// leaves two side by side, the stronger one stays (`A - | C` → `A | C`)
const JOINERS = "|›»>/·•–—~-"
const JOINER = String.raw`[|›»>/·•–—~\-]`
const JOINER_RUN = new RegExp(String.raw`\s*${JOINER}(?:\s*${JOINER})+`, "gu")
const strongest = (run: string): string => {
  const found = Array.from(run).filter((char) => JOINERS.includes(char))
  const best = found.reduce((a, b) => (JOINERS.indexOf(b) < JOINERS.indexOf(a) ? b : a))
  return ` ${best}`
}
// "bıçağı." + "." → "bıçağı."; an ellipsis "..." stays as it is
const SENTENCE_END_THEN_STOP = /(?<!\.)([.!?…])\s*\.(?!\.)/gu
const JOINER_THEN_PUNCT = new RegExp(String.raw`\s*${JOINER}\s*([.,:;])`, "gu")
const PUNCT_THEN_JOINER = new RegExp(String.raw`\s*[,:;]\s*(${JOINER})`, "gu")
const LEADING = new RegExp(String.raw`^(?:\s|${JOINER}|[.,:;])+`, "u")
// A trailing full stop is punctuation the template wants; other marks are leftovers
const TRAILING_LEFTOVER = new RegExp(String.raw`[\s,:;]|${JOINER}`, "u")

// Walks back from the end: a `…+$` pattern rescans long runs from every start
function trimTrailing(text: string): string {
  let end = text.length
  while (end > 0 && TRAILING_LEFTOVER.test(text.charAt(end - 1))) {
    end -= 1
  }
  return text.slice(0, end)
}

function tidy(text: string): string {
  const collapsed = text
    .replace(/\s+/gu, " ")
    .replace(JOINER_RUN, strongest)
    .replace(SENTENCE_END_THEN_STOP, "$1")
    .replace(JOINER_THEN_PUNCT, "$1")
    .replace(PUNCT_THEN_JOINER, " $1")
    .replace(/\s+([.,:;!?])/gu, "$1")
    .replace(LEADING, "")
  return trimTrailing(collapsed)
}

/**
 * Fills a template checked with `assertValidTemplate`. Missing or blank
 * values drop out with their separators: `{a} | {b} | {c}` without `b`
 * renders `A | C`.
 */
export function renderTemplate(
  template: string,
  values: Readonly<Record<string, string | null | undefined>>
): string {
  const filled = template.normalize("NFC").replace(TOKEN, (_match, name: string) => {
    // Own keys only: a stray `{constructor}` must not read the prototype
    const value = Object.hasOwn(values, name) ? values[name] : undefined
    return (value ?? "").normalize("NFC").trim().slice(0, MAX_VALUE_LENGTH)
  })
  return tidy(filled)
}

// A title's parts sit between joiners with a space on each side (`A | B - C`);
// a hyphen inside a word or a number (`N690-Böhler`, `1-2`) joins nothing
const SPACED_JOINER = new RegExp(String.raw`(\s+${JOINER}\s+)`, "u")
const partKey = (part: string): string =>
  part.normalize("NFC").toLocaleLowerCase("tr-TR").replace(/\s+/gu, " ").trim()

/**
 * A title without a part that repeats an earlier one, dropped with the joiner
 * before it (docs/13 §3): the shop's name comes once when the brand is the
 * shop's name, the record's name already ends with it, or an author is named
 * as the shop is (`X | My L'arte | My L'arte` → `X | My L'arte`). Only whole
 * parts, case and spacing aside; the first of them stays where it is.
 */
export function withoutRepeatedParts(title: string): string {
  const pieces = title.split(SPACED_JOINER)
  const first = pieces[0] ?? ""
  const seen = new Set([partKey(first)])
  let kept = first
  for (let index = 1; index < pieces.length; index += 2) {
    const part = pieces[index + 1] ?? ""
    const key = partKey(part)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    kept += `${pieces[index] ?? ""}${part}`
  }
  return kept
}
