import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import type { FilterValues } from "@/features/products/components/product-filters"
import { PRODUCT_SORTS } from "@/features/products/search"

const F = "products.filters"

/** The list's order, beside the filter button: not a filter, never a chip. */
export function ProductSort({
  value,
  onChange,
}: {
  value: FilterValues["sort"]
  onChange: (sort: FilterValues["sort"]) => void
}) {
  const { t } = useTranslation()
  const sort = value ?? PRODUCT_SORTS[0]
  return (
    <Select
      value={sort}
      onValueChange={(next) => {
        onChange(next === PRODUCT_SORTS[0] ? undefined : (next as FilterValues["sort"]))
      }}
    >
      <SelectTrigger className="w-auto min-w-44" aria-label={t(`${F}.sort`)}>
        <SelectValue>{`${t(`${F}.sort`)}: ${t(`${F}.sorts.${sort}`)}`}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {PRODUCT_SORTS.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`${F}.sorts.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
