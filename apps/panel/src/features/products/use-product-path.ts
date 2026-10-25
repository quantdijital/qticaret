import { useQuery } from "@tanstack/react-query"
import { seoSettingsQuery } from "@/features/settings/api/seo"

/** Where a product lives in the shop (docs/13 §2.2): /urun/{slug}, or /{slug} with flat URLs. */
export function useProductPathPrefix(): string {
  const { data } = useQuery(seoSettingsQuery())
  return data?.values.url_style.product === "flat" ? "/" : "/urun/"
}
