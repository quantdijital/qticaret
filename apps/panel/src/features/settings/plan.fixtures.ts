import type { LimitStanding, PlanSummary } from "@/features/settings/api/plan"

/** A shop's plan as `GET /admin/plan` gives it, for tests (adr/0061 Ek C14). */
export const LIMITS: LimitStanding[] = [
  { key: "products", kind: "block", unit: "count", monthly: false, used: 120, max: 500 },
  { key: "orders_per_month", kind: "warn", unit: "count", monthly: true, used: 42, max: 300 },
  { key: "staff", kind: "block", unit: "count", monthly: false, used: 2, max: 3, pending: 1 },
  { key: "storage_mb", kind: "block", unit: "mb", monthly: false, used: 380, max: 2048 },
  {
    key: "llm_credits_per_month",
    kind: "block",
    unit: "count",
    monthly: true,
    used: 7,
    max: 100,
  },
  { key: "custom_domains", kind: "later", unit: "count", monthly: false, used: null, max: 1 },
]

export function planOf(
  changes: Partial<PlanSummary> = {},
  limits: Partial<Record<LimitStanding["key"], Partial<LimitStanding>>> = {}
): PlanSummary {
  return {
    managed: true,
    status: "active",
    package_code: "standart",
    period: "2026-11",
    warning_ratio: 0.8,
    limits: LIMITS.map((limit) => ({ ...limit, ...limits[limit.key] })),
    billing: {
      status: "active",
      due_on: "2026-12-01",
      grace_ends_on: null,
      amount: 149900,
      currency: "TRY",
    },
    payment_instruction: null,
    ...changes,
  }
}
