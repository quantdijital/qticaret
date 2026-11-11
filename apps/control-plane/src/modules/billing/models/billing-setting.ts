import { model } from "@medusajs/framework/utils"

/** The platform's billing settings, by key (Ek C16). */
export const BILLING_SETTING_KEYS = ["payment_instruction"] as const
export type BillingSettingKey = (typeof BILLING_SETTING_KEYS)[number]

/**
 * A platform-wide billing setting (Ek C16): today only the payment
 * instruction every shop's panel shows (account holder, IBAN, what to
 * write as the description). Set by the owner behind a step-up; it reaches
 * the shops inside their signed plan document, never from a shop's own
 * settings or env.
 */
export const BillingSetting = model
  .define("billing_setting", {
    id: model.id({ prefix: "bset" }).primaryKey(),
    key: model.enum([...BILLING_SETTING_KEYS]),
    value: model.text().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([{ on: ["key"], unique: true, where: "deleted_at IS NULL" }])
