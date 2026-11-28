import { z } from "zod"
import { tenantIdSchema } from "./signature"

/**
 * The shop's hourly usage report (adr/0061 §5.4), the body of a signed
 * `POST /tenant-api/v1/usage`. Totals only: no person, address, e-mail,
 * order line or sales amount. Strict at every level: an unknown field
 * fails the report, so nothing more can be sent than this lists.
 */

export const USAGE_REPORT_VERSION = 1

// A Postgres integer at most (C13 review L1): a larger count is a refused report, not a 500
export const USAGE_COUNT_MAX = 2_147_483_647
const count = z.int().min(0).max(USAGE_COUNT_MAX)

/**
 * The shop's own setup checklist as yes/no facts (the shop panel's setup
 * steps, docs/17, plus what makes it ready to sell): never a provider's
 * name, an account, a count or a person. Every key is required, so a
 * report says "no" rather than leaving a step out; an unknown one fails.
 * A new key is a contract change: the control plane takes it first.
 */
export const SETUP_FACT_KEYS = [
  "store_named",
  "currency",
  "region",
  "stock_location",
  "shipping",
  "payment",
  "product_published",
  "look_published",
  "legal_published",
  "mail_sender",
] as const
export type SetupFactKey = (typeof SETUP_FACT_KEYS)[number]

export const usageSetupSchema = z.strictObject({
  store_named: z.boolean(),
  currency: z.boolean(),
  region: z.boolean(),
  stock_location: z.boolean(),
  shipping: z.boolean(),
  payment: z.boolean(),
  product_published: z.boolean(),
  look_published: z.boolean(),
  legal_published: z.boolean(),
  mail_sender: z.boolean(),
})
export type UsageSetup = z.infer<typeof usageSetupSchema>

export const usageReportSchema = z.strictObject({
  version: z.literal(USAGE_REPORT_VERSION),
  tenant_id: tenantIdSchema,
  reported_at: z.iso.datetime(),
  /** The calendar month (Europe/Istanbul) the monthly counts belong to. */
  period: z.string().regex(/^[0-9]{4}-(?:0[1-9]|1[0-2])$/, "must be a month (YYYY-MM)"),
  counts: z.strictObject({
    products: count,
    orders_this_month: count,
    staff: count,
    storage_mb: count,
    llm_credits_this_month: count,
  }),
  last_order_at: z.iso.datetime().nullable(),
  /** The running release: semver and the commit it was built from. */
  release: z.strictObject({
    version: z
      .string()
      .regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/, "must be a semver version"),
    commit: z.string().regex(/^[0-9a-f]{7,40}$/, "must be a commit hash"),
  }),
  /**
   * The setup checklist (optional: a shop on an older release sends none,
   * and the control plane takes its report all the same). Rollout: the
   * control plane first (it accepts the field), then the shops.
   */
  setup: usageSetupSchema.optional(),
})
export type UsageReport = z.infer<typeof usageReportSchema>

/** A report's body is held to this before it is parsed. */
export const USAGE_REPORT_MAX_BYTES = 4 * 1024

// Turkey has kept UTC+3 all year since 2016
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * The report's `period` for a moment: the calendar month in Turkey,
 * `YYYY-MM` (Ek C13). One rule for both ends: the shop builds the period
 * with it, the control plane refuses a report whose period is not its own
 * `reported_at`'s.
 */
export function usagePeriodOf(at: Date): string {
  return new Date(at.getTime() + TURKEY_OFFSET_MS).toISOString().slice(0, 7)
}
