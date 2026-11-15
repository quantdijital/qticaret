/**
 * Finding a line on a wholesale list's screen (ADR-0068 §4): by product
 * name, variant name or SKU, each word somewhere, Turkish case folded
 * ("ışık" finds "IŞIK").
 */

export interface SearchableLine {
  product_title: string
  variant_title: string | null
  sku: string | null
}

const fold = (text: string): string => text.toLocaleLowerCase("tr")

export function lineMatches(line: SearchableLine, q: string | undefined): boolean {
  const words = fold(q ?? "")
    .split(/\s+/)
    .filter((word) => word.length > 0)
  if (words.length === 0) {
    return true
  }
  const text = fold([line.product_title, line.variant_title ?? "", line.sku ?? ""].join(" "))
  return words.every((word) => text.includes(word))
}

/** By product name, then variant name, as the price list screen orders them. */
export const byName = (a: SearchableLine, b: SearchableLine): number =>
  a.product_title.localeCompare(b.product_title, "tr") ||
  (a.variant_title ?? "").localeCompare(b.variant_title ?? "", "tr")
