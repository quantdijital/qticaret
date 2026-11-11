import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  BillingPeriod,
  ChargeStatus,
  PaymentMethod,
  ReminderKind,
  SubscriptionStatus,
  TenantStatus,
} from "@qticaret/types/control-plane"
import type { StaffRole } from "@/features/auth/api"
import { TENANTS_KEY, tenantKey, tenantPath } from "@/features/tenants/api"
import { api } from "@/lib/api"
import { withStepUp } from "@/lib/step-up"

/**
 * Billing as the control plane answers it (adr/0061 §7, Ek C16): a shop's
 * subscription, charges and reminders; the payments lists; the platform's
 * payment instruction. Amounts are kuruş; days are Istanbul `YYYY-MM-DD`.
 */

export type ChargeStanding = "upcoming" | "past_due" | "overdue"

export interface Charge {
  id: string
  period: BillingPeriod
  period_start: string
  period_end: string
  amount: number
  list_amount: number
  currency_code: string
  due_on: string
  status: ChargeStatus
  /** Null unless open. */
  standing: ChargeStanding | null
  grace_ends_on: string
  paid_on: string | null
  method: PaymentMethod | null
  reference: string | null
  /** Who settled it (a name), and when; why it was waived or voided. */
  settled_by: string | null
  settled_at: string | null
  settle_reason: string | null
  amount_reason: string | null
  invoice_number: string | null
}

export interface Subscription {
  id: string
  tenant_id: string
  package: { id: string; code: string; name: string } | null
  price: number
  period: BillingPeriod
  started_on: string
  trial_ends_on: string | null
  current_period_start: string
  current_period_end: string
  grace_days: number
  grace_days_override: number | null
  grace_override_reason: string | null
  grace_days_effective: number
  status: SubscriptionStatus
}

export interface Reminder {
  id: string
  charge_id: string
  kind: ReminderKind
  outcome: "pending" | "sent" | "skipped" | "failed"
  error_code: string | null
  sent_at: string | null
  created_at: string
}

export interface SubscriptionDetail {
  subscription: Subscription | null
  charges: Charge[]
  reminders: Reminder[]
  today: string
  invoicing: string
}

export const PAYMENT_VIEWS = ["upcoming", "overdue", "paid"] as const
export type PaymentView = (typeof PAYMENT_VIEWS)[number]

export interface PaymentRow {
  id: string
  tenant: { id: string; name: string | null; slug: string | null; status: TenantStatus | null }
  period_start: string
  period_end: string
  amount: number
  currency_code: string
  due_on: string
  status: ChargeStatus
  standing: ChargeStanding | null
  grace_ends_on: string
  paid_on: string | null
  method: PaymentMethod | null
  settled_by: string | null
}

export interface PaymentList {
  payments: PaymentRow[]
  count: number
  total: number
  counts: Record<PaymentView, number>
  today: string
}

export interface BillingSettings {
  payment_instruction: string | null
  updated_at: string | null
  updated_by: string | null
}

export const PAYMENTS_PAGE_SIZE = 50

const BILLING_KEY = ["billing"] as const
export const subscriptionKey = (id: string) => [...BILLING_KEY, "subscription", id] as const
const PAYMENTS_KEY = [...BILLING_KEY, "payments"] as const
const SETTINGS_KEY = [...BILLING_KEY, "settings"] as const

export const subscriptionQuery = (id: string) =>
  queryOptions({
    queryKey: subscriptionKey(id),
    queryFn: () => api<SubscriptionDetail>(tenantPath(id, "/subscription")),
  })

export const paymentsQuery = (filter: { view: PaymentView; q: string; page: number }) =>
  queryOptions({
    queryKey: [...PAYMENTS_KEY, filter],
    queryFn: () =>
      api<PaymentList>("/admin/cp/payments", {
        query: {
          view: filter.view,
          ...(filter.q ? { q: filter.q } : {}),
          limit: String(PAYMENTS_PAGE_SIZE),
          offset: String(filter.page * PAYMENTS_PAGE_SIZE),
        },
      }),
    placeholderData: keepPreviousData,
  })

export const billingSettingsQuery = () =>
  queryOptions({
    queryKey: SETTINGS_KEY,
    queryFn: () => api<BillingSettings>("/admin/cp/billing-settings"),
  })

/** Marking paid, waiving and correcting an amount: finance's and the owner's (route table). */
export const canSettle = (role: StaffRole | null | undefined) =>
  role === "owner" || role === "finance"

/** Voiding a charge and the payment instruction: the owner's alone. */
export const isOwner = (role: StaffRole | null | undefined) => role === "owner"

const post = <O = unknown>(path: string, body: unknown, headers?: Record<string, string>) =>
  api<O>(path, { method: "POST", body, ...(headers ? { headers } : {}) })

export type ChargeAction =
  | { action: "pay"; body: { paid_on: string; method: PaymentMethod; reference: string } }
  | { action: "waive"; body: { reason: string } }
  | { action: "void"; body: { reason: string } }
  | { action: "amount"; body: { amount: number; reason: string } }

/** A change to a shop's billing: its subscription, its page, the lists, read again. */
function useBillingChange<I>(tenantId: string, call: (input: I) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: call,
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: subscriptionKey(tenantId) })
      await client.invalidateQueries({ queryKey: PAYMENTS_KEY })
      await client.invalidateQueries({ queryKey: tenantKey(tenantId) })
      await client.invalidateQueries({ queryKey: [...TENANTS_KEY, "list"] })
    },
  })
}

/** "Ödendi", "Bağışla", "Tutarı düzelt" and voiding: each behind a step-up (adr/0061 §3.5). */
export const useChargeAction = (tenantId: string, chargeId: string) =>
  useBillingChange(tenantId, (input: ChargeAction) =>
    withStepUp((headers) =>
      post(tenantPath(tenantId, `/charges/${chargeId}/${input.action}`), input.body, headers)
    )
  )

/** The shop's own grace days (null: the package's), with the reason. */
export const useSetGrace = (tenantId: string) =>
  useBillingChange(tenantId, (input: { grace_days: number | null; reason?: string }) =>
    withStepUp((headers) => post(tenantPath(tenantId, "/subscription"), input, headers))
  )

/** The payment instruction every shop shows (owner, step-up). */
export function useSetInstruction() {
  const client = useQueryClient()
  return useMutation({
    gcTime: 0,
    mutationFn: (value: string) =>
      withStepUp((headers) =>
        post<BillingSettings>("/admin/cp/billing-settings", { payment_instruction: value }, headers)
      ),
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}
