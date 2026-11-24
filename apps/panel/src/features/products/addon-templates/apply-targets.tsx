import { useQueryClient } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import type { PickerOption } from "@qticaret/admin-ui/patterns/search-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { categoriesQuery } from "@/features/products/api/lookups"
import { treeOrder } from "@/features/products/category-order"
import { searchProducts } from "@/features/promotions/api/scope-options"

const P = "products.addonTemplates.apply"

const folded = (text: string) => text.toLocaleLowerCase("tr")

/** One category, searched by name; its place in the tree shows as its path. */
export function CategoryTarget({
  value,
  onChange,
}: {
  value: PickerOption | null
  onChange: (value: PickerOption | null) => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const search = async (q: string): Promise<PickerOption[]> => {
    const rows = treeOrder(await client.query(categoriesQuery()))
    const names = new Map(rows.map(({ category }) => [category.id, category]))
    const pathOf = (id: string | null | undefined): string[] => {
      const category = id ? names.get(id) : undefined
      return category ? [...pathOf(category.parent_category_id), category.name] : []
    }
    return rows
      .filter(({ category }) => folded(category.name).includes(folded(q)))
      .map(({ category }) => ({ id: category.id, label: pathOf(category.id).join(" › ") }))
  }
  return (
    <SearchPicker
      id="addon-apply-category"
      value={value}
      onChange={onChange}
      search={search}
      queryKey={["addon-templates", "apply-category"]}
      placeholder={t(`${P}.categoryPlaceholder`)}
      empty={t(`${P}.noCategories`)}
      className="sm:max-w-none"
    />
  )
}

/** Products picked one by one, shown as chips that can be let go. */
export function ProductsTarget({
  value,
  onChange,
}: {
  value: PickerOption[]
  onChange: (value: PickerOption[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <SearchPicker
        id="addon-apply-products"
        value={null}
        onChange={(picked) => {
          if (picked && !value.some((each) => each.id === picked.id)) {
            onChange([...value, picked])
          }
        }}
        search={searchProducts}
        queryKey={["addon-templates", "apply-products"]}
        placeholder={t(`${P}.productPlaceholder`)}
        empty={t(`${P}.noProducts`)}
        className="sm:max-w-none"
      />
      {value.length > 0 ? (
        <ul data-scroll-area="y" className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {value.map((product) => (
            <li
              key={product.id}
              className="flex items-center gap-1 rounded-md border bg-muted/40 py-1 pr-1 pl-2.5 text-[13px]"
            >
              {product.label}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t(`${P}.removeProduct`, { name: product.label })}
                onClick={() => {
                  onChange(value.filter((each) => each.id !== product.id))
                }}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
