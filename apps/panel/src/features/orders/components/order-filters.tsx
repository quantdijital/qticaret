import { useTranslation } from "react-i18next"
import type { DayRange } from "@qticaret/admin-ui/patterns/day-range-filter"
import type { FilterDef, FilterValue, FilterValues } from "@qticaret/admin-ui/patterns/filter-bar"
import {
  CARRIER_FILTERS,
  PAYMENT_FILTERS,
  PAYMENT_METHODS,
  SHIPPING_FILTERS,
} from "@/features/orders/api/orders"
import { choicesOf, choicesText } from "@/features/orders/search"
import { useCarrierShown } from "@/features/settings/api/carriers"
import type { OrderListSearch } from "@/features/orders/search"

/**
 * The address's change for the list: its own filters and a page's extra
 * ones (the wholesaler) in one, so they go into the address at once.
 */
export type OrderFilterChange = OrderListSearch & Readonly<Record<string, unknown>>

const CLEARED: OrderFilterChange = {
  payment: undefined,
  shipping: undefined,
  method: undefined,
  carrier: undefined,
  from: undefined,
  to: undefined,
}

/** A page's own filters beside the list's (the wholesaler on the wholesale list). */
export interface ExtraOrderFilters {
  filters: FilterDef[]
  values: FilterValues
  /** The address's change when one of them is set or cleared. */
  change: (key: string, value: FilterValue) => Readonly<Record<string, unknown>>
  /** The address's change when every one is cleared. */
  cleared: Readonly<Record<string, unknown>>
}

const MULTI_KEYS: readonly string[] = ["payment", "shipping", "method", "carrier"]

/**
 * The order list's filters (F12.3) for its filter bar: where the money and
 * the parcel stand, how it was paid and who carries it (several choices
 * each, an order matching any), and the days it was placed on; a page's
 * own filters after them. Every choice goes into the address.
 */
export function useOrderFilters(
  search: OrderListSearch,
  onChange: (next: OrderFilterChange) => void,
  extra?: ExtraOrderFilters
): {
  filters: FilterDef[]
  values: FilterValues
  onChange: (key: string, value: FilterValue) => void
  onClear: () => void
} {
  const { t } = useTranslation()
  const shown = useCarrierShown()
  const F = "orders.filters"
  const choices = (options: readonly string[], words: string) =>
    options.map((value) => ({ value, label: t(`${F}.${words}.${value}`) }))
  return {
    filters: [
      {
        key: "payment",
        label: t(`${F}.payment`),
        kind: "multi",
        options: choices(PAYMENT_FILTERS, "payments"),
      },
      {
        key: "shipping",
        label: t(`${F}.shipping`),
        kind: "multi",
        options: choices(SHIPPING_FILTERS, "shippings"),
      },
      {
        key: "method",
        label: t(`${F}.method`),
        kind: "multi",
        options: choices(PAYMENT_METHODS, "methods"),
      },
      {
        key: "carrier",
        label: t(`${F}.carrier`),
        kind: "multi",
        // A carrier suspended on this server is not a choice (adr/0027 Ek 2026-11-26)
        options: choices(CARRIER_FILTERS.filter(shown), "carriers"),
      },
      { key: "days", label: t(`${F}.days`), kind: "days", hint: t(`${F}.daysHint`) },
      ...(extra?.filters ?? []),
    ],
    values: {
      ...choicesOf(search),
      days: { from: search.from, to: search.to },
      ...extra?.values,
    },
    onChange: (key, value) => {
      if (key === "days") {
        const days = value as DayRange | undefined
        onChange({ from: days?.from, to: days?.to })
        return
      }
      if (MULTI_KEYS.includes(key)) {
        // The bar only hands back a filter's own choices, in its order; a comma text in the address
        onChange({ [key]: choicesText(value as readonly string[] | undefined) })
        return
      }
      if (extra) {
        onChange(extra.change(key, value))
      }
    },
    onClear: () => {
      onChange({ ...CLEARED, ...extra?.cleared })
    },
  }
}
