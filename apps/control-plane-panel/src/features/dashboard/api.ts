import { queryOptions } from "@tanstack/react-query"
import type { TenantStatus } from "@qticaret/types/control-plane"
import type { HealthTarget } from "@/features/monitoring/api"
import { api } from "@/lib/api"

/**
 * The dashboard as the control plane sums it (GET /admin/cp/dashboard,
 * adr/0061 C18, Ek C18). Amounts are kuruş, TRY; days Istanbul `YYYY-MM-DD`.
 */

export interface ListedShop {
  id: string
  /** Null when the record is gone. */
  name: string | null
  slug: string | null
  status: TenantStatus | null
}

export interface DuePayment {
  tenant: ListedShop
  /** Null for a renewal whose charge opens later. */
  charge_id: string | null
  due_on: string
  amount: number
  projected?: boolean
}

export interface AttentionRow {
  tenant: ListedShop
  problem: "unhealthy" | "stale"
  target: HealthTarget | null
  since: string
  error: string | null
}

export interface Dashboard {
  today: string
  shops: {
    active: number
    restricted: number
    suspended: number
    provisioning: number
    total: number
  }
  revenue: {
    mrr: number
    paying_count: number
    trial: { count: number; mrr: number }
    currency_code: string
  }
  overdue: { count: number; total: number; oldest: DuePayment[] }
  renewals: {
    days: number
    from: string
    to: string
    count: number
    total: number
    open: { count: number; total: number }
    projected: { count: number; total: number }
    next: DuePayment[]
  }
  health: {
    unhealthy: number
    failing: number
    stale: number
    stale_after_hours: number
    drift: number
    shops: AttentionRow[]
  }
}

/** Read again every minute while the page is open (the probes run every five). */
export const dashboardQuery = () =>
  queryOptions({
    queryKey: ["dashboard"] as const,
    queryFn: () => api<Dashboard>("/admin/cp/dashboard"),
    refetchInterval: 60_000,
  })
