import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** `GET /admin/home/summary`: order numbers worked out on the server, no personal data. */
export interface HomeSummary {
  open_orders: number
  awaiting_shipment: number
  capped: boolean
  today: {
    orders: number
    sales: { currency_code: string; amount: string }[]
    capped: boolean
  }
}

export const summaryQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "summary"],
    queryFn: () => sdk.client.fetch<HomeSummary>("/admin/home/summary"),
    staleTime: 30_000,
  })

export interface ProductCounts {
  published: number
  draft: number
}

// One row at most, ids only: the count is what matters
const COUNT_ONLY = { limit: 1, fields: "id" } as const

export const productCountsQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "product-counts"],
    queryFn: async (): Promise<ProductCounts> => {
      const [published, draft] = await Promise.all([
        sdk.admin.product.list({ ...COUNT_ONLY, status: ["published"] }),
        sdk.admin.product.list({ ...COUNT_ONLY, status: ["draft"] }),
      ])
      return { published: published.count, draft: draft.count }
    },
    staleTime: 30_000,
  })
