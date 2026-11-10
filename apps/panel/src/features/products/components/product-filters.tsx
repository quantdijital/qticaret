import { useQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SearchPicker } from "@/components/patterns/search-picker"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { brandOptions, brandQuery } from "@/features/brands/api/brands"
import { categoriesQuery } from "@/features/products/api/lookups"
import { treeOrder } from "@/features/products/category-order"
import {
  KIND_FILTERS,
  MISSING_FILTERS,
  PRODUCT_SORTS,
  STOCK_FILTERS,
} from "@/features/products/search"
import type { ProductListSearch } from "@/features/products/search"

const F = "products.filters"
const ANY = "__any"

export type FilterValues = Pick<
  ProductListSearch,
  "category" | "brand" | "stock" | "missing" | "kind" | "sort"
>

interface ProductFilterBarProps {
  values: FilterValues
  onChange: (next: Partial<FilterValues>) => void
}

// One width for every control in the row (docs/18 §2, "Denge"); full width on a phone
const CONTROL = "w-full sm:w-52"

/** A filter of fixed choices, "any" first; the trigger says what it filters by. */
function ChoiceFilter<T extends string>({
  label,
  any,
  value,
  options,
  text,
  onChange,
}: {
  label: string
  any: string
  value: T | undefined
  options: readonly T[]
  text: (option: T) => string
  onChange: (next: T | undefined) => void
}) {
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => {
        onChange(next === ANY ? undefined : (next as T))
      }}
    >
      <SelectTrigger className={CONTROL} aria-label={label}>
        <SelectValue>{value ? `${label}: ${text(value)}` : any}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{any}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {text(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The shop's categories in their tree, each indented under its parent; one takes those below it. */
function CategoryFilter({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (id?: string) => void
}) {
  const { t } = useTranslation()
  const categories = useQuery(categoriesQuery())
  const rows = treeOrder(categories.data ?? [])
  const chosen = rows.find((row) => row.category.id === value)?.category.name
  return (
    <Select
      value={value ?? ANY}
      onValueChange={(next) => {
        onChange(next === ANY ? undefined : next)
      }}
    >
      <SelectTrigger className={CONTROL} aria-label={t(`${F}.category`)}>
        <SelectValue>
          {value ? `${t(`${F}.category`)}: ${chosen ?? "…"}` : t(`${F}.anyCategory`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{t(`${F}.anyCategory`)}</SelectItem>
        {rows.map(({ category, depth }) => (
          <SelectItem
            key={category.id}
            value={category.id}
            style={{ paddingLeft: `${String(8 + depth * 16)}px` }}
          >
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** A brand, searched on the server; the chosen one named from its record. */
function BrandFilter({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (id?: string) => void
}) {
  const { t } = useTranslation()
  const brand = useQuery({ ...brandQuery(value ?? ""), enabled: Boolean(value) })
  return (
    <div className={CONTROL}>
      <SearchPicker
        label={t(`${F}.brand`)}
        value={value ? { id: value, label: brand.data?.name ?? "…" } : null}
        onChange={(next) => {
          onChange(next?.id)
        }}
        search={brandOptions}
        queryKey={["brands", "options"]}
        placeholder={t(`${F}.anyBrand`)}
        empty={t("brands.noneFound")}
        inactiveNote={t("brands.inactive")}
        className="sm:max-w-none"
      />
    </div>
  )
}

/**
 * The product list's filters (owner 2026-11-06), one row of equal
 * controls under the search, wrapping on a phone: category (and the ones
 * below it), brand, stock, the "eksik" quick filters, the kind and the
 * order. Every choice goes into the address.
 */
export function ProductFilterBar({ values, onChange }: ProductFilterBarProps) {
  const { t } = useTranslation()
  const filtered = Boolean(
    values.category ?? values.brand ?? values.stock ?? values.missing ?? values.kind
  )
  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <CategoryFilter
        value={values.category}
        onChange={(category) => {
          onChange({ category })
        }}
      />
      <BrandFilter
        value={values.brand}
        onChange={(brand) => {
          onChange({ brand })
        }}
      />
      <ChoiceFilter
        label={t(`${F}.stock`)}
        any={t(`${F}.anyStock`)}
        value={values.stock}
        options={STOCK_FILTERS}
        text={(option) => t(`${F}.stocks.${option}`)}
        onChange={(stock) => {
          onChange({ stock })
        }}
      />
      <ChoiceFilter
        label={t(`${F}.missing`)}
        any={t(`${F}.anyMissing`)}
        value={values.missing}
        options={MISSING_FILTERS}
        text={(option) => t(`${F}.missings.${option}`)}
        onChange={(missing) => {
          onChange({ missing })
        }}
      />
      <ChoiceFilter
        label={t(`${F}.kind`)}
        any={t(`${F}.anyKind`)}
        value={values.kind}
        options={KIND_FILTERS}
        text={(option) => t(`${F}.kinds.${option}`)}
        onChange={(kind) => {
          onChange({ kind })
        }}
      />
      <Select
        value={values.sort ?? PRODUCT_SORTS[0]}
        onValueChange={(next) => {
          onChange({ sort: next === PRODUCT_SORTS[0] ? undefined : (next as FilterValues["sort"]) })
        }}
      >
        <SelectTrigger className={CONTROL} aria-label={t(`${F}.sort`)}>
          <SelectValue>
            {`${t(`${F}.sort`)}: ${t(`${F}.sorts.${values.sort ?? PRODUCT_SORTS[0]}`)}`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRODUCT_SORTS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {t(`${F}.sorts.${sort}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filtered ? (
        <Button
          variant="ghost"
          className="w-full sm:ml-auto sm:w-auto"
          onClick={() => {
            onChange({
              category: undefined,
              brand: undefined,
              stock: undefined,
              missing: undefined,
              kind: undefined,
            })
          }}
        >
          <X aria-hidden="true" />
          {t(`${F}.clear`)}
        </Button>
      ) : null}
    </div>
  )
}
