/**
 * Registries shared by the control plane and every shop (adr/0061 §2, §5).
 * A new key here is a code change on purpose: the shop must know how to
 * apply it before a package can set it.
 */

/** A shop's lifecycle as the control plane keeps it (adr/0061 §2). */
export const TENANT_STATUSES = [
  "provisioning",
  "active",
  "restricted",
  "suspended",
  "closing",
  "closed",
] as const
export type TenantStatus = (typeof TENANT_STATUSES)[number]

/**
 * Allowed moves. `restricted` is automatic (overdue payment); `suspended`
 * and `closing` are staff decisions only; `closed` is final.
 */
export const TENANT_STATUS_TRANSITIONS: Readonly<Record<TenantStatus, readonly TenantStatus[]>> = {
  provisioning: ["active"],
  active: ["restricted", "suspended", "closing"],
  restricted: ["active", "suspended", "closing"],
  suspended: ["active", "restricted", "closing"],
  closing: ["closed"],
  closed: [],
}

export function canTransitionTenant(from: TenantStatus, to: TenantStatus): boolean {
  return TENANT_STATUS_TRANSITIONS[from].includes(to)
}

/** The subscription's own state; a trial is not a shop status (adr/0061 §2). */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "restricted",
  "cancelled",
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const BILLING_PERIODS = ["monthly", "yearly"] as const
export type BillingPeriod = (typeof BILLING_PERIODS)[number]

/**
 * How the shop applies a limit (adr/0061 §5.3): `block` answers 403
 * `plan.limit_reached` on the write that would pass it; `warn` never blocks
 * (orders), it warns at 80% and 100%; `later` is not enforced yet.
 */
export type LimitEnforcement = "block" | "warn" | "later"

export interface LimitDefinition {
  unit: "count" | "mb"
  /** Counted per calendar month (Europe/Istanbul) rather than as a total. */
  monthly: boolean
  enforcement: LimitEnforcement
}

export const LIMIT_KEYS = [
  "products",
  "orders_per_month",
  "staff",
  "storage_mb",
  "llm_credits_per_month",
  "custom_domains",
] as const
export type LimitKey = (typeof LIMIT_KEYS)[number]

export const LIMIT_REGISTRY: Readonly<Record<LimitKey, LimitDefinition>> = {
  products: { unit: "count", monthly: false, enforcement: "block" },
  orders_per_month: { unit: "count", monthly: true, enforcement: "warn" },
  staff: { unit: "count", monthly: false, enforcement: "block" },
  storage_mb: { unit: "mb", monthly: false, enforcement: "block" },
  llm_credits_per_month: { unit: "count", monthly: true, enforcement: "block" },
  // Custom domains arrive with F16.7
  custom_domains: { unit: "count", monthly: false, enforcement: "later" },
}

/** A share of a limit at which the panel warns (adr/0061 §5.3). */
export const LIMIT_WARNING_RATIO = 0.8

/**
 * A feature flag key (adr/0012: `area.name`). Which keys are `owner:
 * platform` is the shop's registry; a document may name only those.
 */
export const FEATURE_FLAG_KEY = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/

/**
 * A subscription's charge (adr/0061 §2, Ek C16): `open` until staff mark it
 * `paid`, `waived` (forgiven) or `void` (made by mistake). Only an open
 * charge is owed.
 */
export const CHARGE_STATUSES = ["open", "paid", "waived", "void"] as const
export type ChargeStatus = (typeof CHARGE_STATUSES)[number]

/** How a payment was made; the platform charges no card itself (adr/0061 §7). */
export const PAYMENT_METHODS = ["bank_transfer", "card_manual", "other"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * The payment reminders (adr/0061 §7), each sent at most once per charge:
 * days before the due day, on it, three days after, and when the shop is
 * restricted.
 */
export const REMINDER_KINDS = [
  "before_14",
  "before_7",
  "before_3",
  "before_1",
  "due",
  "overdue_3",
  "restricted",
] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]
