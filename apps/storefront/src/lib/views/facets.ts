import { formatLira } from "@qticaret/ui"
import type { FilterGroupView, LinkView, PriceFilterView, Translate } from "@qticaret/ui"
import type { ListingAnswer } from "@/lib/store-api/listings"
import { cleared, hrefOf, searchOf, toggled, withPrice } from "./listing"
import type { ListingState } from "./listing"

const BRAND = "marka"

export interface FilterViews {
  filters: FilterGroupView[]
  price: PriceFilterView | null
  active: LinkView[]
  clearPath: string | null
}

/**
 * The listing's filters as links (D4): each value toggles itself in the
 * address, its count what the list would hold; a filter with one value and
 * nothing chosen narrows nothing and is left out, as is the brand filter
 * on a brand's own page. What is chosen shows again as links that take it
 * away.
 */
export function filterViews(
  pathname: string,
  state: ListingState,
  facets: ListingAnswer["facets"],
  isBrandPage: boolean,
  t: Translate,
  swatchOf: (value: string) => string | null = () => null
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

  const labels = new Map(
    groups.flatMap((group) =>
      group.values.map((value) => [`${group.key}:${value.value}`, value.label] as const)
    )
  )
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
  const range = facets.price
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
    active,
    clearPath: active.length > 0 ? hrefOf(pathname, cleared(state)) : null,
  }
}
