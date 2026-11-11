import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { BillingPeriod, LimitKey } from "@qticaret/types/control-plane"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"

/** A package (adr/0061 §2): its price in kuruş per period, its days and every registry limit. */
export interface Plan {
  id: string
  code: string
  name: string
  /** Kuruş, TRY. */
  price: number
  currency_code: string
  period: BillingPeriod
  trial_days: number
  grace_days: number
  archived_at: string | null
  created_at: string
  /** Null: no limit. */
  limits: Record<LimitKey, number | null>
  /** Its platform flags as set; a flag left out takes its default (adr/0061 Ek C9). */
  features: Record<string, boolean>
  /** How many shops are on it (the list). */
  tenant_count?: number
}

/** A flag a package may set (`owner: platform`, the shared list) and its default. */
export interface PlatformFlag {
  key: string
  default: boolean
}

export const PLANS_KEY = ["plans"] as const

export const plansQuery = () =>
  queryOptions({
    queryKey: PLANS_KEY,
    queryFn: () => api<{ plans: Plan[]; platform_flags: PlatformFlag[] }>("/admin/cp/plans"),
  })

const planPath = (id: string, rest = "") => `/admin/cp/plans/${encodeURIComponent(id)}${rest}`

function usePlanChange<I, O>(call: (input: I) => Promise<O>) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: call,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: PLANS_KEY })
      await client.invalidateQueries({ queryKey: ["tenants"] })
    },
  })
}

export interface PlanInput {
  name: string
  price: number
  period: BillingPeriod
  trial_days: number
  grace_days: number
  limits: Record<LimitKey, number | null>
  /** Every platform flag's value; left out when there are none (Ek C9). */
  features?: Record<string, boolean>
}

/** A new package (owner, finance; a step-up: it sets a price); its code is fixed once made. */
export const useCreatePlan = () =>
  usePlanChange((input: PlanInput & { code: string }) =>
    withStepUp((headers) =>
      api<{ plan: Plan }>("/admin/cp/plans", { method: "POST", body: input, headers })
    )
  )

/**
 * A package's changes in one save: its name, days, limits and flags; its price
 * and period apart, behind a step-up (adr/0061 §3.5), only when they moved.
 */
export const useUpdatePlan = () =>
  usePlanChange(async ({ id, before, input }: { id: string; before: Plan; input: PlanInput }) => {
    const { price, period, ...rest } = input
    await api(planPath(id), { method: "POST", body: rest })
    if (price !== before.price || period !== before.period) {
      await withStepUp((headers) =>
        api(planPath(id, "/price"), { method: "POST", body: { price, period }, headers })
      )
    }
  })

/** Archived: offered to no new shop; the shops on it keep it. Restored: offered again. */
export const useArchivePlan = () =>
  usePlanChange(({ id, archive }: { id: string; archive: boolean }) =>
    api(planPath(id, archive ? "/archive" : "/restore"), { method: "POST", body: {} })
  )
