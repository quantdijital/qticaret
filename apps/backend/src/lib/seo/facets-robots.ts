import { DATED_PARAMS } from "./facets-dated"
import { LISTING_PARAMS, filterKeysOf } from "./facets"

/**
 * robots.txt lines that keep crawlers off filtered and sorted listings
 * (docs/13 §7): a parameter first in the query or after another. Landing
 * pages have paths of their own and stay open; so do numbered pages.
 */
export function facetDisallowLines(filterKeys: Iterable<string>): string[] {
  const keys = [
    LISTING_PARAMS.brand,
    ...[...filterKeysOf(filterKeys)].sort(),
    LISTING_PARAMS.stock,
    LISTING_PARAMS.price,
    LISTING_PARAMS.sort,
    // adr/0077 §2; `kategori` lives on `/arama`, closed already, and `sirala=kalkis` under `sirala`
    DATED_PARAMS.dates,
    DATED_PARAMS.months,
    DATED_PARAMS.pax,
  ]
  return [...new Set(keys)].flatMap((key) => [`Disallow: /*?${key}=`, `Disallow: /*&${key}=`])
}
