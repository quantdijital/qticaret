import { useQuery } from "@tanstack/react-query"
import { seoSettingsQuery } from "@/features/settings/api/seo"

/** Where a brand page lives (docs/13 §2.2): /marka/{slug}, or /{slug} with flat URLs. */
export function useBrandPathPrefix(): string {
  const { data } = useQuery(seoSettingsQuery())
  return data?.values.url_style.brand === "flat" ? "/" : "/marka/"
}
