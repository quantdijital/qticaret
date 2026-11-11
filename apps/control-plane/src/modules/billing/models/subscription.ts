import { model } from "@medusajs/framework/utils"
import { BILLING_PERIODS, SUBSCRIPTION_STATUSES } from "@qticaret/types/control-plane"

/**
 * A shop's subscription (adr/0061 §2 `billing`, §7, Ek C16): one per shop,
 * started when it becomes `active`. It keeps its own copy of the package's
 * price and period for the period running now (a price change applies from
 * a later period, no proration), its trial, its grace days (the package's,
 * or the shop's own when staff set one) and where it stands.
 *
 * Calendar days are Europe/Istanbul days written `YYYY-MM-DD` (Ek C16):
 * a due day is a day, not an instant, and the text sorts as the day does.
 */
export const Subscription = model
  .define("subscription", {
    id: model.id({ prefix: "sub" }).primaryKey(),
    tenant_id: model.text(),
    /** The package the running period was priced from. */
    package_id: model.text(),
    /** Kuruş, TRY: the running period's price as quoted. */
    price: model.number(),
    currency_code: model.text().default("TRY"),
    period: model.enum([...BILLING_PERIODS]),
    /** The day the subscription started. */
    started_on: model.text(),
    /** The trial's first unpaid day after it; null without a trial. */
    trial_ends_on: model.text().nullable(),
    /** The running period: its first day and the next period's first day. */
    current_period_start: model.text(),
    current_period_end: model.text(),
    /** The day of the month periods start on (the first paid day's), 1-31. */
    anchor_day: model.number(),
    /** The package's grace days, copied as each period starts. */
    grace_days: model.number(),
    /** The shop's own grace days, set by staff with a reason; null: the package's. */
    grace_days_override: model.number().nullable(),
    grace_override_reason: model.text().nullable(),
    status: model.enum([...SUBSCRIPTION_STATUSES]).default("active"),
  })
  .indexes([
    { on: ["tenant_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status"], where: "deleted_at IS NULL" },
  ])
