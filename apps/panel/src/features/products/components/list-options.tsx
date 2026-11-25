import { SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { HIDEABLE_COLUMNS, PAGE_SIZES } from "@/features/products/list-prefs"
import type { HideableColumn, ListPrefs, PageSize } from "@/features/products/list-prefs"

// A column's name as its header reads it
const COLUMN_LABEL: Record<HideableColumn, string> = {
  status: "products.columns.status",
  stock: "products.columns.stock",
  variants: "products.columns.variants",
  category: "products.columns.category",
  updated: "products.columns.updated",
  seo: "seo.advisor.column",
  price: "products.columns.price",
}

/**
 * "Görünüm" beside the order (WooCommerce's Screen Options): products per
 * page and the columns shown. The menu stays open while columns are
 * ticked, so several can be turned off in one go.
 */
export function ListOptions({
  value,
  onChange,
}: {
  value: ListPrefs
  onChange: (next: ListPrefs) => void
}) {
  const { t } = useTranslation()
  const toggle = (column: HideableColumn, shown: boolean) => {
    const hidden = shown
      ? value.hidden.filter((item) => item !== column)
      : [...value.hidden, column]
    onChange({ ...value, hidden: HIDEABLE_COLUMNS.filter((item) => hidden.includes(item)) })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={t("products.listOptions.label")}>
          <SlidersHorizontal />
          <span className="max-sm:sr-only">{t("products.listOptions.label")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>{t("products.listOptions.perPage")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(value.pageSize)}
          onValueChange={(next) => {
            onChange({ ...value, pageSize: Number(next) as PageSize })
          }}
        >
          {PAGE_SIZES.map((size) => (
            <DropdownMenuRadioItem key={size} value={String(size)}>
              {t("products.listOptions.pageSize", { count: size })}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("products.listOptions.columns")}</DropdownMenuLabel>
        {HIDEABLE_COLUMNS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={!value.hidden.includes(column)}
            onSelect={(event) => {
              event.preventDefault()
            }}
            onCheckedChange={(shown) => {
              toggle(column, shown)
            }}
          >
            {t(COLUMN_LABEL[column])}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
