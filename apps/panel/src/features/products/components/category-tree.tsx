import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { categoriesQuery } from "@/features/products/api/lookups"
import { treeOrder } from "@/features/products/category-order"

interface CategoryTreeProps {
  value: string[]
  onChange: (ids: string[]) => void
}

/** The shop's categories as an indented checklist; a product may sit in several. */
export function CategoryTree({ value, onChange }: CategoryTreeProps) {
  const { t } = useTranslation()
  const categories = useQuery(categoriesQuery())
  if (categories.isPending) {
    return <Skeleton className="h-40 w-full" />
  }
  const rows = treeOrder(categories.data ?? [])
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("products.wizard.noCategories")}</p>
  }
  return (
    <ul className="relative flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-md border p-1.5">
      {rows.map(({ category, depth }) => (
        <li key={category.id}>
          <label
            className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted"
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            <Checkbox
              checked={value.includes(category.id)}
              onCheckedChange={(next) => {
                onChange(next ? [...value, category.id] : value.filter((id) => id !== category.id))
              }}
            />
            {category.name}
          </label>
        </li>
      ))}
    </ul>
  )
}
