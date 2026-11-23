import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The SEO settings the panel reads outside the SEO screens (the storefront's host). */
export interface SeoSettingsResponse {
  values: {
    canonical_host: string | null
    url_style: {
      product: "prefixed" | "flat"
      category: "prefixed" | "nested" | "flat"
      brand: "prefixed" | "flat"
    }
  }
  version: number
  /** Where the storefront opens, as the backend's configuration says (read only); null: unknown. */
  storefront_url?: string | null
}

export const seoSettingsQuery = () =>
  queryOptions({
    queryKey: ["settings", "seo"],
    queryFn: () => sdk.client.fetch<SeoSettingsResponse>("/admin/platform-settings/seo"),
    staleTime: 5 * 60_000,
  })
