import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import type { Lifecycle } from "./overview"

/** `GET /admin/dashboard/recent-orders`: a recorded read of personal data (adr/0011). */
export interface RecentOrder {
  id: string
  display_id: number
  created_at: string
  currency_code: string
  total: string
  items: number
  stage: Lifecycle
  customer: { name: string | null; place: string | null }
}

export const recentOrdersQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "recent-orders"],
    queryFn: () => sdk.client.fetch<{ orders: RecentOrder[] }>("/admin/dashboard/recent-orders"),
    staleTime: 60_000,
  })
