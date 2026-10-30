import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Shorter than this, a search finds everything and means nothing. */
export const SEARCH_MIN = 2

/** What the panel's search box finds (F12.9): a few of each. */
export interface GlobalSearch {
  orders: {
    id: string
    display_id: number
    name: string | null
    total: number | string
    currency_code: string
  }[]
  customers: { id: string; name: string | null; email: string }[]
  /** `sku`: the variant's SKU the search matched, when it was one. */
  products: { id: string; title: string; sku: string | null }[]
  parcels: {
    order_id: string
    display_id: number | null
    tracking_number: string
    provider: string
  }[]
}

export const globalSearchQuery = (q: string) =>
  queryOptions({
    queryKey: ["global-search", q],
    queryFn: () => sdk.client.fetch<GlobalSearch>("/admin/global-search", { query: { q } }),
    staleTime: 30_000,
  })
