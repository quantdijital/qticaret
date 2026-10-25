import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The SEO settings the panel reads outside the SEO screens (the storefront's host). */
export interface SeoSettingsResponse {
  values: { canonical_host: string | null }
  version: number
}

export const seoSettingsQuery = () =>
  queryOptions({
    queryKey: ["settings", "seo"],
    queryFn: () => sdk.client.fetch<SeoSettingsResponse>("/admin/platform-settings/seo"),
    staleTime: 5 * 60_000,
  })
