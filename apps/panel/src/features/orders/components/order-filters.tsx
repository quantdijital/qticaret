import { useTranslation } from "react-i18next"
import type { DayRange } from "@qticaret/admin-ui/patterns/day-range-filter"
import type { FilterDef, FilterValue, FilterValues } from "@qticaret/admin-ui/patterns/filter-bar"
import {
  CARRIER_FILTERS,
  PAYMENT_FILTERS,
  PAYMENT_METHODS,
  SHIPPING_FILTERS,
} from "@/features/orders/api/orders"
import type { OrderListSearch } from "@/features/orders/search"

type FilterKey = "payment" | "shipping" | "method" | "carrier" | "from" | "to"
export type OrderFilterChange = Pick<OrderListSearch, FilterKey>

const CLEARED: OrderFilterChange = {
  payment: undefined,
  shipping: undefined,
  method: undefined,
  carrier: undefined,
  from: undefined,
  to: undefined,
}

/**
 * The order list's filters (F12.3) for its filter bar: where the money and
 * the parcel stand, how it was paid, who carries it and the days it was
 * placed on. One choice each, as the server takes them; every choice goes
 * into the address.
 */
export function useOrderFilters(
  search: OrderListSearch,
  onChange: (next: OrderFilterChange) => void
): {
  filters: FilterDef[]
  values: FilterValues
  onChange: (key: string, value: FilterValue) => void
  onClear: () => void
} {
  const { t } = useTranslation()
  const F = "orders.filters"
  const choices = (options: readonly string[], words: string) =>
    options.map((value) => ({ value, label: t(`${F}.${words}.${value}`) }))
  return {
    filters: [
      {
        key: "payment",
        label: t(`${F}.payment`),
        kind: "single",
        options: choices(PAYMENT_FILTERS, "payments"),
      },
      {
        key: "shipping",
        label: t(`${F}.shipping`),
        kind: "single",
        options: choices(SHIPPING_FILTERS, "shippings"),
      },
      {
        key: "method",
        label: t(`${F}.method`),
        kind: "single",
        options: choices(PAYMENT_METHODS, "methods"),
      },
      {
        key: "carrier",
        label: t(`${F}.carrier`),
        kind: "single",
        options: choices(CARRIER_FILTERS, "carriers"),
      },
      { key: "days", label: t(`${F}.days`), kind: "days", hint: t(`${F}.daysHint`) },
    ],
    values: {
      payment: search.payment,
      shipping: search.shipping,
      method: search.method,
      carrier: search.carrier,
      days: { from: search.from, to: search.to },
    },
    onChange: (key, value) => {
      if (key === "days") {
        const days = value as DayRange | undefined
        onChange({ from: days?.from, to: days?.to })
        return
      }
      // The bar only hands back a filter's own choices
      onChange({ [key]: value })
    },
    onClear: () => {
      onChange(CLEARED)
    },
  }
}
