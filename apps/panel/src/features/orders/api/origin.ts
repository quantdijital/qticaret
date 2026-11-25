import { queryOptions } from "@tanstack/react-query"
import type { TrafficSource } from "@/features/reports/api/sales"
import { sdk } from "@/lib/sdk"

/** Where the order's shopper first landed from (O6), as its cart recorded it; no personal data. */
export interface OrderOrigin {
  source: Exclude<TrafficSource, "unknown">
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer_host: string | null
  landed_at: string
}

/** `GET /admin/orders/:id/origin`: null when nothing was recorded. */
export const orderOriginQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["orders", "origin", orderId],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ origin: OrderOrigin | null }>(
          `/admin/orders/${encodeURIComponent(orderId)}/origin`
        )
      ).origin,
    // The first landing never changes after the order
    staleTime: Infinity,
  })
