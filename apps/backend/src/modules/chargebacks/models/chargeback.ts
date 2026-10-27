import { model } from "@medusajs/framework/utils"

/**
 * A cardholder's dispute of an order's payment (F6.7, adr/0030), recorded
 * by the shop from the provider's notice (no provider sends one yet). It
 * moves from open to evidence submitted to won or lost; a closed one does
 * not reopen. Amounts in kuruş.
 */
export const Chargeback = model
  .define("chargeback", {
    id: model.id({ prefix: "chbk" }).primaryKey(),
    order_id: model.text(),
    payment_id: model.text(),
    provider: model.text(),
    /** The provider's own reference for the dispute, when it gives one. */
    provider_reference: model.text().nullable(),
    amount: model.number(),
    currency_code: model.text(),
    reason: model.enum(["not_received", "unauthorized", "not_as_described", "duplicate", "other"]),
    status: model.enum(["open", "evidence_submitted", "won", "lost"]).default("open"),
    /** When the provider wants the evidence by. */
    due_at: model.dateTime().nullable(),
    note: model.text().nullable(),
    created_by: model.text().nullable(),
    closed_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["order_id"] }, { on: ["payment_id", "status"] }, { on: ["status", "due_at"] }])
