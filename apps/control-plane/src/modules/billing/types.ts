import type {
  BillingPeriod,
  ChargeStatus,
  PaymentMethod,
  ReminderKind,
  SubscriptionStatus,
} from "@qticaret/types/control-plane"
import type { ReminderOutcome } from "./models/reminder"

export interface SubscriptionRecord {
  id: string
  tenant_id: string
  package_id: string
  price: number
  currency_code: string
  period: BillingPeriod
  started_on: string
  trial_ends_on: string | null
  current_period_start: string
  current_period_end: string
  anchor_day: number
  grace_days: number
  grace_days_override: number | null
  grace_override_reason: string | null
  status: SubscriptionStatus
  created_at: Date
}

export const SUBSCRIPTION_FIELDS = [
  "id",
  "tenant_id",
  "package_id",
  "price",
  "currency_code",
  "period",
  "started_on",
  "trial_ends_on",
  "current_period_start",
  "current_period_end",
  "anchor_day",
  "grace_days",
  "grace_days_override",
  "grace_override_reason",
  "status",
  "created_at",
] as const

export interface ChargeRecord {
  id: string
  subscription_id: string
  tenant_id: string
  period: BillingPeriod
  period_start: string
  period_end: string
  amount: number
  list_amount: number
  currency_code: string
  due_on: string
  status: ChargeStatus
  paid_on: string | null
  method: PaymentMethod | null
  reference: string | null
  settled_by: string | null
  settled_at: Date | null
  settle_reason: string | null
  amount_reason: string | null
  invoice_number: string | null
  invoice_ettn: string | null
  invoice_pdf_url: string | null
  created_at: Date
}

export const CHARGE_FIELDS = [
  "id",
  "subscription_id",
  "tenant_id",
  "period",
  "period_start",
  "period_end",
  "amount",
  "list_amount",
  "currency_code",
  "due_on",
  "status",
  "paid_on",
  "method",
  "reference",
  "settled_by",
  "settled_at",
  "settle_reason",
  "amount_reason",
  "invoice_number",
  "invoice_ettn",
  "invoice_pdf_url",
  "created_at",
] as const

export interface ReminderRecord {
  id: string
  charge_id: string
  tenant_id: string
  kind: ReminderKind
  channel: string
  outcome: ReminderOutcome
  error_code: string | null
  sent_at: Date | null
  created_at: Date
}

export const REMINDER_FIELDS = [
  "id",
  "charge_id",
  "tenant_id",
  "kind",
  "channel",
  "outcome",
  "error_code",
  "sent_at",
  "created_at",
] as const

/** The package a period is priced from, as the plans module has it now. */
export interface PackageTerms {
  id: string
  price: number
  period: BillingPeriod
  trial_days: number
  grace_days: number
}

/** A change staff make to an open charge (Ek C16). */
export type ChargeChange =
  | {
      kind: "pay"
      paid_on: string
      method: PaymentMethod
      reference: string | null
      actor: string
    }
  | { kind: "waive"; reason: string; actor: string }
  | { kind: "void"; reason: string; actor: string }
  | { kind: "amount"; amount: number; reason: string; actor: string }

export type PaymentsView = "upcoming" | "overdue" | "paid"

export interface PaymentsFilter {
  view: PaymentsView
  today: string
  tenant_id?: string[] | undefined
  /** Due days (paid days for `paid`) from and to, inclusive. */
  from?: string | undefined
  to?: string | undefined
  limit: number
  offset: number
}
