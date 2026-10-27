import { model } from "@medusajs/framework/utils"

/**
 * Money a provider took that became no order (adr/0026 §6): a session
 * replaced while its form stayed payable, a payment that does not match
 * its session, a cart that could not be completed. Each is given back by
 * the recovery job; one that cannot be is left for the shop, with an alert.
 */
export const PaymentRecovery = model
  .define("payment_recovery", {
    id: model.id({ prefix: "precov" }).primaryKey(),
    provider: model.text(),
    /** The provider's reference for the payment, e.g. PayTR's `merchant_oid`. */
    reference: model.text(),
    /** Kuruş taken. */
    amount: model.number(),
    currency_code: model.text(),
    test_mode: model.boolean(),
    reason: model.enum(["session_gone", "amount_mismatch", "completion_failed"]),
    status: model.enum(["pending", "refunded", "failed"]).default("pending"),
    attempts: model.number().default(0),
    /** Our reference for the refund, so an answer lost on the way can be looked up. */
    refund_reference: model.text(),
    error_code: model.text().nullable(),
    cart_id: model.text().nullable(),
    refunded_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["provider", "reference"], unique: true }, { on: ["status", "updated_at"] }])
