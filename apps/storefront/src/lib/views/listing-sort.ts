import type { ListingSort } from "@qticaret/types"
import type { SortOptionView, Translate } from "@qticaret/ui"
import { hrefOf, withSort } from "./listing"
import type { ListingState } from "./listing"

/**
 * A listing's sorts as links in the backend's canonical form: its own
 * order first (a search's is relevance), the newest, the price both ways
 * (a wholesaler's says it is the retail price, ADR-0068 §7), and with
 * dates asked the nearest departure first (adr/0077 §2).
 */
export function sortOptions(
  pathname: string,
  state: ListingState,
  { isSearch, retailOnly, dated }: { isSearch: boolean; retailOnly: boolean; dated: boolean },
  t: Translate
): SortOptionView[] {
  const option = (label: string, sort: ListingSort | null): SortOptionView => ({
    label: t(label),
    path: hrefOf(pathname, withSort(state, sort)),
    current: state.sort === sort,
  })
  return [
    option(isSearch ? "search.sort_relevance" : "listing.sort_recommended", null),
    option("listing.sort_newest", "yeni"),
    option(retailOnly ? "listing.sort_retail_price_up" : "listing.sort_price_up", "fiyat-artan"),
    option(
      retailOnly ? "listing.sort_retail_price_down" : "listing.sort_price_down",
      "fiyat-azalan"
    ),
    ...(dated ? [option("search.sort_departure", "kalkis")] : []),
  ]
}
