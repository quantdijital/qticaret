import { formatLira } from "@qticaret/ui"
import type {
  FilterGroupView,
  LinkView,
  PriceFilterView,
  StockFilterView,
  Translate,
} from "@qticaret/ui"
import type { ListingAnswer } from "@/lib/store-api/listings"
import {
  IN_STOCK,
  STOCK,
  cleared,
  hrefOf,
  isInStockOnly,
  searchOf,
  toggled,
  withPrice,
} from "./listing"
import type { ListingState } from "./listing"

const BRAND = "marka"

export interface FilterViews {
  filters: FilterGroupView[]
  price: PriceFilterView | null
  stock: StockFilterView | null
  active: LinkView[]
  clearPath: string | null
}

/**
 * "Yalnızca stokta olanlar" (adr/0056): offered when the listing route
 * counts it, unless nothing is in stock and it is off (it would narrow
 * the list to nothing). On, it stays to be turned off again.
 */
function stockView(
  pathname: string,
  state: ListingState,
  facet: ListingAnswer["facets"]["stock"],
  t: Translate
): StockFilterView | null {
  const selected = isInStockOnly(state)
  if (!facet || (facet.count === 0 && !selected)) {
    return null
  }
  return {
    label: t("listing.in_stock_only"),
    count: facet.count,
    selected,
    path: hrefOf(pathname, toggled(state, STOCK, IN_STOCK)),
  }
}

/**
 * The listing's filters as links (D4): each value toggles itself in the
 * address, its count what the list would hold; a filter with one value and
 * nothing chosen narrows nothing and is left out, as is the brand filter
 * on a brand's own page. The in-stock toggle is one more such link. What
 * is chosen shows again as links that take it away. `priceRange` false (a
 * wholesaler's, ADR-0068 §7: the index holds retail prices): no price
 * range form; a range already chosen still shows, to be taken away.
 */
export function filterViews(
  pathname: string,
  state: ListingState,
  facets: ListingAnswer["facets"],
  isBrandPage: boolean,
  t: Translate,
  swatchOf: (value: string) => string | null = () => null,
  priceRange = true
): FilterViews {
  const groups = [
    ...(isBrandPage ? [] : [{ key: BRAND, label: t("listing.brand"), values: facets.brands }]),
    ...facets.attributes,
  ]
  const filters: FilterGroupView[] = groups
    .filter((group) => group.values.length > 1 || group.values.some((value) => value.selected))
    .map((group) => ({
      key: group.key,
      label: group.label,
      options: group.values.map((value) => ({
        label: value.label,
        count: value.count,
        selected: value.selected,
        path: hrefOf(pathname, toggled(state, group.key, value.value)),
        swatch: group.key === BRAND ? null : swatchOf(value.label),
      })),
    }))

  const labels = new Map([
    ...groups.flatMap((group) =>
      group.values.map((value) => [`${group.key}:${value.value}`, value.label] as const)
    ),
    [`${STOCK}:${IN_STOCK}`, t("listing.in_stock_only")] as const,
  ])
  const active: LinkView[] = state.filters.flatMap(([key, values]) =>
    values.map((value) => ({
      label: labels.get(`${key}:${value}`) ?? value,
      path: hrefOf(pathname, toggled(state, key, value)),
    }))
  )
  if (state.price) {
    active.push({
      label: t("listing.price_between", {
        min: state.price.min === null ? "…" : formatLira(state.price.min),
        max: state.price.max === null ? "…" : formatLira(state.price.max),
      }),
      path: hrefOf(pathname, withPrice(state, null)),
    })
  }

  // The price form keeps the rest of the query as hidden fields
  const keep = new URLSearchParams(searchOf({ ...state, price: null, page: 1 }))
  const range = priceRange ? facets.price : null
  const price: PriceFilterView | null =
    range && (range.max > range.min || state.price)
      ? {
          action: pathname,
          min: range.min,
          max: range.max,
          currentMin: state.price?.min ?? null,
          currentMax: state.price?.max ?? null,
          keep: [...keep.entries()].map(([name, value]) => ({ name, value })),
        }
      : null

  return {
    filters,
    price,
    stock: stockView(pathname, state, facets.stock, t),
    active,
    clearPath: active.length > 0 ? hrefOf(pathname, cleared(state)) : null,
  }
}
