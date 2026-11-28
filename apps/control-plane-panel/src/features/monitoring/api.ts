import { queryOptions } from "@tanstack/react-query"
import type { UsageSetup } from "@qticaret/types/control-plane"
import { tenantPath } from "@/features/tenants/api"
import { api } from "@/lib/api"

/**
 * A shop's usage and health (adr/0061 §5.4, Ek C13) as the control plane
 * answers them: the shop's own hourly totals (never a person, an address
 * or an amount) and the control plane's probes of it.
 */

export type HealthState = "healthy" | "failing" | "unhealthy"
export type HealthTarget = "backend" | "storefront"

export interface UsageCounts {
  products: number
  orders_this_month: number
  staff: number
  storage_mb: number
  llm_credits_this_month: number
}

export interface UsageSnapshot {
  reported_at: string
  received_at: string
  period: string
  counts: UsageCounts
  last_order_at: string | null
  release: { version: string; commit: string }
}

export interface Probe {
  checked_at: string
  ok: boolean
  status_code: number | null
  latency_ms: number | null
  error: string | null
}

export interface Standing {
  state: HealthState
  consecutive_failures: number
  checked_at: string
  last_ok_at: string | null
  unhealthy_since: string | null
  status_code: number | null
  latency_ms: number | null
  error: string | null
}

export interface TargetHealth {
  /** Whether the shop has an address for it (else it is not probed). */
  probed: boolean
  /** Null until probed once. */
  standing: Standing | null
  /** The last probes, newest first. */
  history: Probe[]
  /** The last 24 hours' probes and how many answered. */
  day: { total: number; ok: number }
}

export interface UsageHealth {
  usage: UsageSnapshot | null
  /** Ek C21: its last reported setup checklist (yes/no) and when; null if it never sent one. */
  setup: { setup: UsageSetup; received_at: string } | null
  report: { expected: boolean; missing: boolean; missing_after_hours: number }
  health: { unhealthy_after: number; backend: TargetHealth; storefront: TargetHealth }
}

export const usageHealthKey = (id: string) => ["tenants", "usage-health", id] as const

/** Read again every minute while the tab is open and the browser tab is in view. */
export const usageHealthQuery = (id: string) =>
  queryOptions({
    queryKey: usageHealthKey(id),
    queryFn: () => api<UsageHealth>(tenantPath(id, "/usage-health")),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
