import { useQuery } from "@tanstack/react-query"
import { seoSettingsQuery } from "@/features/settings/api/seo"

/** Where the storefront's category pages start: `/kategori/` or the site root (docs/13 §2). */
export function useCategoryPathPrefix(): string {
  const { data } = useQuery(seoSettingsQuery())
  return data?.values.url_style.category === "flat" ? "/" : "/kategori/"
}
