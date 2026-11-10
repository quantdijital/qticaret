import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { DayRangeFilter } from "@qticaret/admin-ui/patterns/day-range-filter"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import {
  CARRIER_FILTERS,
  PAYMENT_FILTERS,
  PAYMENT_METHODS,
  SHIPPING_FILTERS,
} from "@/features/orders/api/orders"
import { isFiltered } from "@/features/orders/search"
import type { OrderListSearch } from "@/features/orders/search"

const ANY = "__any"

/** A filter beside the search: its choices, "any" first. */
function FilterSelect<T extends string>({
  label,
  value,
  options,
  text,
  onChange,
}: {
  label: string
  value: T | undefined
  options: readonly T[]
  text: (option: T) => string
  onChange: (next: T | undefined) => void
}) {
  const { t } = useTranslation()
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => {
        onChange(next === ANY ? undefined : (next as T))
      }}
    >
      <SelectTrigger className="w-full sm:w-56" aria-label={label}>
        {/* The chosen value with what it filters: "Kargo: Yolda" */}
        <SelectValue>
          {value ? `${label}: ${text(value)}` : t("orders.filters.any", { what: label })}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{t("orders.filters.any", { what: label })}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {text(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type FilterKey = "payment" | "shipping" | "method" | "carrier" | "from" | "to"

/**
 * The order list's filters (F12.3): where the money and the parcel stand,
 * how it was paid, who carries it and the days it was placed on. One row
 * of equal controls, wrapping on a phone; every choice goes into the address.
 */
export function OrderFilters({
  search,
  onChange,
}: {
  search: OrderListSearch
  onChange: (next: Pick<OrderListSearch, FilterKey>) => void
}) {
  const { t } = useTranslation()
  const F = "orders.filters"
  return (
    <>
      <FilterSelect
        label={t(`${F}.payment`)}
        value={search.payment}
        options={PAYMENT_FILTERS}
        text={(option) => t(`${F}.payments.${option}`)}
        onChange={(payment) => {
          onChange({ payment })
        }}
      />
      <FilterSelect
        label={t(`${F}.shipping`)}
        value={search.shipping}
        options={SHIPPING_FILTERS}
        text={(option) => t(`${F}.shippings.${option}`)}
        onChange={(shipping) => {
          onChange({ shipping })
        }}
      />
      <FilterSelect
        label={t(`${F}.method`)}
        value={search.method}
        options={PAYMENT_METHODS}
        text={(option) => t(`${F}.methods.${option}`)}
        onChange={(method) => {
          onChange({ method })
        }}
      />
      <FilterSelect
        label={t(`${F}.carrier`)}
        value={search.carrier}
        options={CARRIER_FILTERS}
        text={(option) => t(`${F}.carriers.${option}`)}
        onChange={(carrier) => {
          onChange({ carrier })
        }}
      />
      <DayRangeFilter
        value={{ from: search.from, to: search.to }}
        hint={t(`${F}.daysHint`)}
        onChange={onChange}
      />
      {isFiltered(search) ? (
        <Button
          variant="ghost"
          className="w-full sm:w-auto"
          onClick={() => {
            onChange({
              payment: undefined,
              shipping: undefined,
              method: undefined,
              carrier: undefined,
              from: undefined,
              to: undefined,
            })
          }}
        >
          <X aria-hidden="true" />
          {t(`${F}.clear`)}
        </Button>
      ) : null}
    </>
  )
}
