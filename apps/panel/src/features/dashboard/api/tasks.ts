import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** `GET /admin/dashboard/tasks`: what waits for the shop, counts only. */
export interface DashboardTasks {
  to_ship: number
  awaiting_payment: number
  low_stock: number
  low_stock_threshold: number
  draft_products: number
  capped: boolean
}

export const tasksQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => sdk.client.fetch<DashboardTasks>("/admin/dashboard/tasks"),
    staleTime: 30_000,
  })
