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

/** Text as one line: tags dropped, spaces collapsed. Descriptions may hold simple HTML. */
export function plainText(text: string | null | undefined): string {
  return (text ?? "")
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
