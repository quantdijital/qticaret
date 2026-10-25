import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { vatTypesQuery } from "@/features/products/api/lookups"

// Radix Select has no empty value; this one stands for "the default rate"
const DEFAULT_VAT = "__default__"

interface VatSelectProps {
  id?: string
  /** The product type that carries the rate (adr/0007); "" for the default. */
  value: string
  onChange: (typeId: string) => void
}

/** The product's KDV group. */
export function VatSelect({ id, value, onChange }: VatSelectProps) {
  const { t } = useTranslation()
  const types = useQuery(vatTypesQuery())
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
        <SelectItem value={DEFAULT_VAT}>{t("products.wizard.vatDefault")}</SelectItem>
        {(types.data ?? []).map((type) => (
          <SelectItem key={type.id} value={type.id}>
            {type.value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
