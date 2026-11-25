import { model } from "@medusajs/framework/utils"

/** The one row's key: the platform's own values. */
export const AI_CREDIT_SETTING_KEYS = ["platform"] as const

/**
 * The AI credits' platform settings (adr/0085 K6, K7, K11, K12, §2): one
 * row, set by the owner. The day's cap every wallet without its own
 * follows, how many months bought credits last from the last top-up, the
 * top-up packs offered (`{id, name, credits, amount, currency, active}`,
 * at most 10) and the routing (capability → `{service, model}`). No row:
 * the defaults of `lib/ai-credits/settings.ts`. Written through the
 * module's own statement only, its values checked on the way in and out.
 */
export const AiCreditSetting = model
  .define("ai_credit_setting", {
    id: model.id({ prefix: "aiset" }).primaryKey(),
    key: model.enum([...AI_CREDIT_SETTING_KEYS]),
    daily_cap: model.number(),
    purchased_lifetime_months: model.number(),
    packs: model.json(),
    routing: model.json(),
    /** The platform user who saved it last. */
    updated_by: model.text().nullable(),
  })
  .indexes([{ on: ["key"], unique: true, where: "deleted_at IS NULL" }])
