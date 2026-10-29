import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { FeedTargetName } from "@/features/settings/api/sections"
import { sdk } from "@/lib/sdk"

/** A feed the shop gives Google, Meta, Cimri or Akakçe (F10.8). */
export interface FeedTarget {
  target: FeedTargetName
  /** The address with its token; null while the feeds are off. */
  url: string | null
  item_count: number | null
  generated_at: string | null
}

export interface FeedsStatus {
  enabled: boolean
  /** Whether the shop has the storefront domain the feeds link to (Settings > SEO). */
  storefront_set: boolean
  targets: FeedTarget[]
}

export const feedsQuery = () =>
  queryOptions({
    queryKey: ["marketing-feeds"],
    queryFn: () => sdk.client.fetch<{ feeds: FeedsStatus }>("/admin/marketing-feeds"),
  })

/** Turns the feeds on or gives them a new address; off; or builds them again now. */
export function useFeedAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (action: "issue" | "off" | "generate") =>
      action === "generate"
        ? sdk.client.fetch("/admin/marketing-feeds/generate", { method: "POST" })
        : sdk.client.fetch("/admin/marketing-feeds/token", {
            method: action === "issue" ? "POST" : "DELETE",
          }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["marketing-feeds"] })
    },
  })
}
