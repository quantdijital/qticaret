import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type {
  FilterDef,
  FilterValue,
  FilterValues as BarValues,
} from "@qticaret/admin-ui/patterns/filter-bar"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import { brandOptions, brandQuery } from "@/features/brands/api/brands"
import { categoriesQuery } from "@/features/products/api/lookups"
import { treeOrder } from "@/features/products/category-order"
import { KIND_FILTERS, MISSING_FILTERS, STOCK_FILTERS } from "@/features/products/search"
import type { ProductListSearch } from "@/features/products/search"

const F = "products.filters"

export type FilterValues = Pick<
  ProductListSearch,
  "category" | "brand" | "stock" | "missing" | "kind" | "sort"
>

/**
 * The product list's filters (owner 2026-11-06) for its filter bar:
 * category (and the ones below it), brand, stock, the "eksik" quick
 * filters and the kind. One choice each, as the server takes them; every
 * choice goes into the address.
 */
export function useProductFilters(
  values: FilterValues,
  onChange: (next: Partial<FilterValues>) => void
): {
  filters: FilterDef[]
  values: BarValues
  onChange: (key: string, value: FilterValue) => void
  onClear: () => void
} {
  const { t } = useTranslation()
  const categories = useQuery(categoriesQuery())
  const brand = useQuery({ ...brandQuery(values.brand ?? ""), enabled: Boolean(values.brand) })
  const choices = (options: readonly string[], words: string) =>
    options.map((value) => ({ value, label: t(`${F}.${words}.${value}`) }))
  return {
    filters: [
      {
        key: "category",
        label: t(`${F}.category`),
        kind: "single",
        // The shop's categories in their tree, each indented under its parent
        options: treeOrder(categories.data ?? []).map(({ category, depth }) => ({
          value: category.id,
          label: category.name,
          depth,
        })),
        format: () => "…",
      },
      {
        key: "brand",
        label: t(`${F}.brand`),
        kind: "custom",
        summary: values.brand ? (brand.data?.name ?? "…") : undefined,
        // A brand searched on the server; the chosen one named from its record
        render: (close) => (
          <SearchPicker
            label={t(`${F}.brand`)}
            value={values.brand ? { id: values.brand, label: brand.data?.name ?? "…" } : null}
            onChange={(next) => {
              onChange({ brand: next?.id })
              close()
            }}
            search={brandOptions}
            queryKey={["brands", "options"]}
            placeholder={t(`${F}.anyBrand`)}
            empty={t("brands.noneFound")}
            inactiveNote={t("brands.inactive")}
            className="sm:max-w-none"
          />
        ),
      },
      {
        key: "stock",
        label: t(`${F}.stock`),
        kind: "single",
        options: choices(STOCK_FILTERS, "stocks"),
      },
      {
        key: "missing",
        label: t(`${F}.missing`),
        kind: "single",
        options: choices(MISSING_FILTERS, "missings"),
      },
      {
        key: "kind",
        label: t(`${F}.kind`),
        kind: "single",
        options: choices(KIND_FILTERS, "kinds"),
      },
    ],
    values,
    onChange: (key, value) => {
      // The bar only hands back a filter's own choices
      onChange({ [key]: value })
    },
    onClear: () => {
      onChange({
        category: undefined,
        brand: undefined,
        stock: undefined,
        missing: undefined,
        kind: undefined,
      })
    },
  }
}
