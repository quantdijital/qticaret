import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export type SeoEntityType =
  "product" | "category" | "collection" | "brand" | "page" | "post" | "landing"
export const ROBOTS_OVERRIDES = ["index_follow", "noindex_follow", "noindex_nofollow"] as const
export type RobotsOverride = (typeof ROBOTS_OVERRIDES)[number]

/** A page's own SEO fields (adr/0015); null means the shop's template applies. */
export interface SeoMeta {
  seo_title: string | null
  seo_description: string | null
  focus_keyword: string | null
  canonical_override: string | null
  robots_override: RobotsOverride | null
  og_image_override: string | null
  og_image_alt: string | null
}

const url = (type: SeoEntityType, id: string) => `/admin/seo/${type}/${encodeURIComponent(id)}`

export const seoMetaQuery = (type: SeoEntityType, id: string) =>
  queryOptions({
    queryKey: ["seo-meta", type, id],
    queryFn: async () => (await sdk.client.fetch<{ seo: SeoMeta }>(url(type, id))).seo,
  })

export interface SeoSaveResult {
  seo: SeoMeta
  /** Other pages of the same type with the same title or description. */
  duplicates: { seo_title: number; seo_description: number }
}

export function useSaveSeoMeta(type: SeoEntityType, id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<SeoMeta>) =>
      sdk.client.fetch<SeoSaveResult>(url(type, id), { method: "PUT", body }),
    onSuccess: async (result) => {
      client.setQueryData(["seo-meta", type, id], result.seo)
      // The page's assessment reads these fields
      await client.invalidateQueries({ queryKey: ["seo", "assessment", type, id] })
    },
  })
}
