/**
 * The words a page's `seo` is made of (docs/13 §3): descriptions as plain
 * text, cut to what a result shows, and the price and shipping sentences
 * the templates fill in.
 */
import { formatLira } from "../money/format"

// docs/13 §3: what a result shows of a description before cutting it
export const DESCRIPTION_EXCERPT = 155
// The `kısa_açıklama` token: a sentence or two of the description
export const SHORT_EXCERPT = 140

// A tag: `<` then a letter (or `/` and a letter), up to its `>`. "3 < 5" is text; no
// `<` inside, so many `<` without a `>` cost one pass, not one pass each
const TAG = /<\/?[a-z][^<>]*>/gi

// The end of a block whose content is never text; searched from a set index, so one pass each
const HIDDEN_ENDS: Readonly<Record<string, RegExp>> = {
  comment: /-->/g,
  script: /<\/script\s*>/gi,
  style: /<\/style\s*>/gi,
}

function hiddenAt(text: string, at: number): string | null {
  const head = text.slice(at, at + 8).toLowerCase()
  if (head.startsWith("<!--")) {
    return "comment"
  }
  return /^<(script|style)[\s>/]/.exec(head)?.[1] ?? null
}

/**
 * The text without comments and `<script>`/`<style>` blocks (an old
 * platform's `<!-- iç not -->` is no description). One scan: each block's
 * end is searched once from its start, and an unclosed block drops the
 * rest, so a long input of openings costs one pass, not one each.
 */
export function withoutHiddenBlocks(text: string): string {
  let out = ""
  let from = 0
  for (let lt = text.indexOf("<"); lt !== -1; lt = text.indexOf("<", lt + 1)) {
    const kind = hiddenAt(text, lt)
    const end = kind ? HIDDEN_ENDS[kind] : undefined
    if (!end) {
      continue
    }
    end.lastIndex = lt + (kind === "comment" ? 4 : 1)
    const found = end.exec(text)
    out += `${text.slice(from, lt)} `
    if (!found) {
      return out
    }
    from = found.index + found[0].length
    lt = from - 1
  }
  return out + text.slice(from)
}

/** Text as one line: comments, scripts, styles and tags dropped, spaces collapsed. Descriptions may hold simple HTML. */
export function plainText(text: string | null | undefined): string {
  return withoutHiddenBlocks(text ?? "")
    .replace(TAG, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** The text cut at a word before `max` characters, without a dangling comma or joiner. */
export function excerpt(text: string, max: number): string {
  const clean = plainText(text)
  if (clean.length <= max) {
    return clean
  }
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/u, "")
}

/**
 * The `fiyat_cümlesi` token (docs/13 §3): "899,00 TL." for one price,
 * "899,00 TL'den başlayan fiyatlarla." for a range; nothing without one.
 */
export function priceSentence(amounts: readonly number[]): string {
  const prices = amounts.filter((amount) => Number.isFinite(amount) && amount > 0)
  if (prices.length === 0) {
    return ""
  }
  const lowest = Math.min(...prices)
  return lowest === Math.max(...prices)
    ? `${formatLira(lowest)}.`
    : `${formatLira(lowest)}'den başlayan fiyatlarla.`
}

/**
 * The `kargo_cümlesi` token (docs/13 §3, F7.8): when an order leaves, in
 * working days ("1–2 iş gününde kargoda."); "Aynı gün kargoda." for none.
 */
export function shippingSentence(handlingMin: number, handlingMax: number): string {
  if (handlingMax <= 0) {
    return "Aynı gün kargoda."
  }
  return handlingMin === handlingMax || handlingMin <= 0
    ? `${String(handlingMax)} iş gününde kargoda.`
    : `${String(handlingMin)}–${String(handlingMax)} iş gününde kargoda.`
}
