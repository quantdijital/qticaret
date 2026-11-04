import { queryOptions, useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** A product's content drafts from a model (F10.13, adr/0005). */
export const DRAFT_KINDS = ["product_description", "seo_title", "seo_description"] as const
export type DraftKind = (typeof DRAFT_KINDS)[number]

export interface Draft {
  id: string
  kind: DraftKind
  text: string
  status: "draft" | "approved" | "rejected" | "refused"
  problems: { problems: string[] } | null
}

export interface DraftsAnswer {
  drafts: Draft[]
  enabled: boolean
  provider_ready: boolean
  quota: { used: number; limit: number }
}

export const draftsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["products", productId, "drafts"],
    queryFn: () =>
      sdk.client.fetch<DraftsAnswer>("/admin/content-drafts", {
        query: { entity_type: "product", entity_id: productId },
      }),
  })

/** Whether the shop writes drafts with a model (Settings > Features) and its provider is set. */
export function useDraftsShown(productId: string): boolean {
  const data = useQuery(draftsQuery(productId)).data
  return Boolean(data?.enabled && data.provider_ready)
}
