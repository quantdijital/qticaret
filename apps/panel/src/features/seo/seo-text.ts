/**
 * The server's text rules for SEO previews (apps/backend/src/lib/seo/resolve.ts):
 * the description excerpt and the price sentence the templates fill in.
 * Keep the two copies in step.
 */

export const DESCRIPTION_EXCERPT = 155
export const SHORT_EXCERPT = 140

/** Text as one line: tags dropped, spaces collapsed. */
export function plainText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** The text cut at a word before `max` characters, without a dangling comma or joiner. */
export function excerpt(text: string | null | undefined, max: number): string {
  const clean = plainText(text)
  if (clean.length <= max) {
    return clean
  }
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/u, "")
}

const formatLira = (amount: number): string =>
  `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} TL`

/** "899,00 TL." for one price, "899,00 TL'den başlayan fiyatlarla." for a range. */
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
