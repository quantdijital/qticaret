import { model } from "@medusajs/framework/utils"
import { AI_CREDIT_ORDER_STATUSES, PAYMENT_METHODS } from "@qticaret/types/control-plane"

/**
 * A top-up request (adr/0085 K11): the pack as it was when asked for (its
 * id, name, credits and price in kuruş), `pending` until staff mark it
 * paid (one `grant_purchase`, `grant_ref` `order:<id>`) or cancel it. A
 * shop has at most one pending request (partial unique index).
 */
export const AiCreditOrder = model
  .define("ai_credit_order", {
    id: model.id({ prefix: "aiord" }).primaryKey(),
    tenant_id: model.text(),
    pack_id: model.text(),
    pack_name: model.text(),
    credits: model.number(),
    /** Kuruş. */
    amount: model.number(),
    currency: model.text(),
    status: model.enum([...AI_CREDIT_ORDER_STATUSES]).default("pending"),
    method: model.enum([...PAYMENT_METHODS]).nullable(),
    /** The bank's receipt or another reference; plain text. */
    reference: model.text().nullable(),
    /** Who asked (the shop's staff, as its signed request says) and who decided (a platform user id). */
    requested_by: model.text().nullable(),
    decided_by: model.text().nullable(),
    requested_at: model.dateTime(),
    decided_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["tenant_id"], unique: true, where: "status = 'pending' AND deleted_at IS NULL" },
    { on: ["status", "requested_at"], where: "deleted_at IS NULL" },
    { on: ["tenant_id", "requested_at"], where: "deleted_at IS NULL" },
  ])
