import type { SeoPageKind } from "./resolve"

/**
 * A listing page's description when its record has none (docs/21 §8): a
 * category, brand or collection left without text still gets a sentence
 * for its result, from its name and the shop's, as the sale page's does.
 * The suffixes hang on the fixed words, so any name reads right. Its
 * wording follows the shop's language once there are more (F19).
 */
const LISTED: Partial<Record<SeoPageKind, string>> = {
  category: "kategorisindeki ürünler",
  collection: "koleksiyonundaki ürünler",
  brand: "markasının ürünleri",
}

const BROWSE = "fiyatları ve stok durumlarıyla, filtreleyip sıralayarak inceleyin."

/** The sentence for `kind`'s page named `name`; empty for any other kind or no name. */
export function listingDescription(kind: SeoPageKind, name: string, shop: string): string {
  const listed = LISTED[kind]
  const own = name.trim()
  if (!listed || !own) {
    return ""
  }
  const what = `${own} ${listed}`
  return shop.trim() ? `${shop.trim()} mağazasında ${what}: ${BROWSE}` : `${what}: ${BROWSE}`
}
