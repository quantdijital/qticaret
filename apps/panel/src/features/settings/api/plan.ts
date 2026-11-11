import { queryOptions, useQuery } from "@tanstack/react-query"
import type { LimitKey } from "@qticaret/types/control-plane"
import { useCan } from "@/features/auth/api/staff"
import { sdk } from "@/lib/sdk"

/** How a limit applies (adr/0061 §5.3): refuses past it, only warns, or not yet. */
export type LimitKind = "block" | "warn" | "later"

export interface LimitStanding {
  key: LimitKey
  kind: LimitKind
  unit: "count" | "mb"
  monthly: boolean
  /** Null where the shop keeps no count (custom domains, later). */
  used: number | null
  /** Null for no limit. */
  max: number | null
  /** Team seats: open invitations counted in `used`. */
  pending?: number
}

export interface BillingSummary {
  status: "trialing" | "active" | "past_due" | "restricted" | "cancelled"
  due_on: string | null
  grace_ends_on: string | null
  /** Kuruş. */
  amount: number | null
  currency: "TRY"
}

/** `GET /admin/plan` (adr/0061 §5.6, Ek C14): the package, its limits and use, billing. */
export interface PlanSummary {
  managed: boolean
  status: string
  package_code: string | null
  period: string
  warning_ratio: number
  limits: LimitStanding[]
  billing: BillingSummary | null
  payment_instruction: string | null
}

export const PLAN_KEY = ["plan"] as const

// An answer of another shape (an older backend, a stand-in) is no plan: nothing is shown
const isPlan = (value: unknown): value is { plan: PlanSummary } => {
  const plan = (value as { plan?: { limits?: unknown; managed?: unknown } } | null)?.plan
  return Array.isArray(plan?.limits) && typeof plan.managed === "boolean"
}

export const planQuery = () =>
  queryOptions({
    queryKey: PLAN_KEY,
    queryFn: async () => {
      const answer: unknown = await sdk.client.fetch("/admin/plan")
      return isPlan(answer) ? answer.plan : null
    },
    staleTime: 60_000,
  })

/**
 * The shop's plan for those who may read it (owner and admin: the
 * `settings` capability, as the API decides); undefined for the others
 * and while it loads, so no notice is shown on a guess.
 */
export function usePlan(): PlanSummary | null | undefined {
  const allowed = useCan("settings")
  return useQuery({ ...planQuery(), enabled: allowed }).data
}

/** One limit's standing, when the plan has it. */
export const standingOf = (
  plan: PlanSummary | null | undefined,
  key: LimitKey
): LimitStanding | undefined => plan?.limits.find((limit) => limit.key === key)

/** A limit's standing for a screen's notice; undefined for a role without the plan or without one. */
export function useLimitStanding(key: LimitKey): LimitStanding | undefined {
  return standingOf(usePlan(), key)
}
