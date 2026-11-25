import { queryOptions, useQuery } from "@tanstack/react-query"
import type { LimitKey } from "@qticaret/types/control-plane"
import { useCan } from "@/features/auth/api/staff"
import { sdk } from "@/lib/sdk"

/**
 * How a limit applies (adr/0061 §5.3): refuses past it, only warns, or not
 * yet; `grant` is what the package gives a month (AI free credits, adr/0085).
 */
export type LimitKind = "block" | "warn" | "later" | "grant"

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
  /**
   * The subscription's terms (adr/0061 Ek C20): a period's length and price
   * (kuruş), the trial's first and next-paid day. Null from an older
   * control plane's document; absent from an older backend.
   */
  period?: "monthly" | "yearly" | null
  price?: number | null
  trial_started_on?: string | null
  trial_ends_on?: string | null
}

/** One of the package's features beyond its limits (a platform flag, Ek C9): on or off. */
export interface PackageFeature {
  key: string
  enabled: boolean
}

/** `GET /admin/plan` (adr/0061 §5.6, Ek C14): the package, its limits and use, billing. */
export interface PlanSummary {
  managed: boolean
  status: string
  package_code: string | null
  /** The package's name as the control plane signs it (Ek C16); null from an older document. */
  package_name: string | null
  period: string
  warning_ratio: number
  limits: LimitStanding[]
  /** What the package turns on or off; absent from an older backend. */
  features?: PackageFeature[]
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

/** One payment to the platform (adr/0061 Ek C20), as the control plane signs it. */
export interface PaymentRecord {
  id: string
  period: "monthly" | "yearly"
  period_start: string
  period_end: string
  due_on: string
  /** Kuruş. */
  amount: number
  currency: "TRY"
  status: "open" | "paid" | "waived"
  paid_on: string | null
  invoice_number: string | null
  /** An https link to the invoice's PDF, when our invoicing made one. */
  invoice_url: string | null
}

/** `GET /admin/plan/payments`: `unavailable` when the control plane could not be read now. */
export interface PaymentHistory {
  state: "ok" | "unmanaged" | "unavailable"
  records: PaymentRecord[]
}

const isHistory = (value: unknown): value is { payments: PaymentHistory } => {
  const payments = (value as { payments?: { records?: unknown; state?: unknown } } | null)?.payments
  return Array.isArray(payments?.records) && typeof payments.state === "string"
}

export const planPaymentsQuery = () =>
  queryOptions({
    queryKey: [...PLAN_KEY, "payments"] as const,
    queryFn: async (): Promise<PaymentHistory> => {
      const answer: unknown = await sdk.client.fetch("/admin/plan/payments")
      // An older backend without the route answers another shape: no history to show
      return isHistory(answer) ? answer.payments : { state: "unavailable", records: [] }
    },
    staleTime: 60_000,
  })

/** One limit's standing, when the plan has it. */
export const standingOf = (
  plan: PlanSummary | null | undefined,
  key: LimitKey
): LimitStanding | undefined => plan?.limits.find((limit) => limit.key === key)

/** A limit's standing for a screen's notice; undefined for a role without the plan or without one. */
export function useLimitStanding(key: LimitKey): LimitStanding | undefined {
  return standingOf(usePlan(), key)
}
