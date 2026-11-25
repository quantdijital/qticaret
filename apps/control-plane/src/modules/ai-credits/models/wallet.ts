import { model } from "@medusajs/framework/utils"

/**
 * A shop's AI credit wallet (adr/0085 §1): one row per shop. Two buckets:
 * this month's grant (`plan_balance` for `plan_period`, an Istanbul
 * calendar month `YYYY-MM`; it does not carry over, K5) and the credits
 * bought (`purchased_balance` until `purchased_expires_at`, K6). The day's
 * spend counts against the cap (K7) for the Istanbul day `spent_day`.
 *
 * Never written through the ORM: every change is one conditional SQL
 * statement in the module's service, in the same transaction as its ledger
 * rows (`ai_credit_entry`), and the database refuses a negative balance.
 */
export const AiCreditWallet = model
  .define("ai_credit_wallet", {
    id: model.id({ prefix: "aiwal" }).primaryKey(),
    tenant_id: model.text(),
    plan_balance: model.number().default(0),
    /** The month the plan balance belongs to; null until the first grant. */
    plan_period: model.text().nullable(),
    purchased_balance: model.number().default(0),
    purchased_expires_at: model.dateTime().nullable(),
    /** The shop's own daily cap; null: the platform's (`AI_DAILY_CAP_DEFAULT`). */
    daily_cap: model.number().nullable(),
    spent_today: model.number().default(0),
    /** The Istanbul day `spent_today` counts (`YYYY-MM-DD`). */
    spent_day: model.text().nullable(),
  })
  .indexes([{ on: ["tenant_id"], unique: true, where: "deleted_at IS NULL" }])
