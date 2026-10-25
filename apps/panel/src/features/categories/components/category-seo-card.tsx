import { useQuery } from "@tanstack/react-query"
import type { Category } from "@/features/categories/api/categories"
import { ancestorHandles } from "@/features/categories/tree"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, excerpt } from "@/features/seo/seo-text"
import { seoSettingsQuery } from "@/features/settings/api/seo"

/** The category's SEO fields, previewed with its path (ancestors' handles, docs/13 §2) and text. */
export function CategorySeoCard({
  category,
  categories,
}: {
  category: Category
  categories: Category[]
}) {
  const { data: seo } = useQuery(seoSettingsQuery())
  const prefix = seo?.values.url_style.category === "flat" ? "/" : "/kategori/"
  const path = [
    ...ancestorHandles(categories, category.parent_category_id ?? null),
    category.handle,
  ].join("/")
  return (
    <SeoCard
      type="category"
      id={category.id}
      context={{
        path: `${prefix}${path}`,
        tokens: { kategori: category.name },
        fallbackDescription: excerpt(category.description, DESCRIPTION_EXCERPT),
      }}
    />
  )
}
