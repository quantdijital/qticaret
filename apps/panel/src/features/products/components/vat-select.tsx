import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { vatLabelOf, vatRatesQuery } from "@/features/settings/api/vat-rates"

// Radix Select has no empty value; this one stands for "the default rate"
const DEFAULT_VAT = "__default__"

interface VatSelectProps {
  id?: string
  /** The product type that carries the rate (adr/0007); "" for the default. */
  value: string
  onChange: (typeId: string) => void
}

/**
 * The product's KDV group: the shop's rates in use (Settings > Invoices and
 * accounting > KDV rates), each by the product type that carries it; none
 * is the default, named with the rate it is today.
 */
export function VatSelect({ id, value, onChange }: VatSelectProps) {
  const { t } = useTranslation()
  const rates = useQuery(vatRatesQuery()).data
  const fallback = rates?.default
  const options = (rates?.rates ?? []).filter((rate) => rate.active && rate.product_type_id)
  // A group no rate in use stands on (one removed elsewhere): shown, not offered
  const unknown =
    rates !== undefined && value !== "" && !options.some((rate) => rate.product_type_id === value)
  return (
    <Select
      value={value || DEFAULT_VAT}
      onValueChange={(next) => {
        onChange(next === DEFAULT_VAT ? "" : next)
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_VAT}>
          {fallback
            ? t("products.wizard.vatDefaultNamed", { name: vatLabelOf(fallback) })
            : t("products.wizard.vatDefault")}
        </SelectItem>
        {options.map((rate) => (
          <SelectItem key={rate.id} value={rate.product_type_id ?? ""}>
            {vatLabelOf(rate)}
          </SelectItem>
        ))}
        {unknown ? (
          <SelectItem value={value} disabled>
            {t("products.wizard.vatUnknown")}
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  )
}
