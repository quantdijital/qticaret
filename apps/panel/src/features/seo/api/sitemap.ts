import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** `GET /admin/seo/sitemap` (docs/13 §6). */
export interface SitemapStatus {
  host_missing: boolean
  indexing: boolean
  generated_at: string | null
  dirty_since: string | null
  files: { name: string; urls: number }[]
}

export const SITEMAP_JOB = "seo.sitemap"

export const sitemapStatusQuery = () =>
  queryOptions({
    queryKey: ["seo", "sitemap"],
    queryFn: () => sdk.client.fetch<SitemapStatus>("/admin/seo/sitemap"),
  })
