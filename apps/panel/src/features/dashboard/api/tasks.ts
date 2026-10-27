import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** `GET /admin/dashboard/tasks`: what waits for the shop, counts only. */
export interface DashboardTasks {
  to_ship: number
  awaiting_payment: number
  low_stock: number
  low_stock_threshold: number
  draft_products: number
  /** Payments that became no order (F5 V4): being given back, or left to the shop. */
  orphan_payments: { refunding: number; by_hand: number }
  capped: boolean
}

export const tasksQuery = () =>
  queryOptions({
    queryKey: ["dashboard", "tasks"],
    queryFn: () => sdk.client.fetch<DashboardTasks>("/admin/dashboard/tasks"),
    staleTime: 30_000,
  })
