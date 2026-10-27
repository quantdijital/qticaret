import { model } from "@medusajs/framework/utils"

/**
 * One money refund of an order (F5 V5, adr/0010), line by line: what each
 * line gave back, in kuruş, and how many of its units. A line never gives
 * back more units than it holds nor more than it was paid, however the
 * refunds come (units, a free amount, a cancel). `reference` is the
 * request's own key: tried again, a refund is made once.
 */
export const OrderRefund = model
  .define("order_refund", {
    id: model.id({ prefix: "oref" }).primaryKey(),
    order_id: model.text(),
    reference: model.text().unique(),
    payment_id: model.text(),
    /** Kuruş given back. */
    amount: model.number(),
    status: model.enum(["pending", "done", "failed"]).default("pending"),
    /** `[{ id, kind, quantity, net }]`: net in kuruş. */
    lines: model.json(),
    note: model.text().nullable(),
    created_by: model.text().nullable(),
    error_code: model.text().nullable(),
    /**
     * A provider that refunds in parts and keeps no record we can read
     * (iyzico, by item transaction): `[{ transaction_id, amount, state }]`,
     * each written `sending` before it is sent and `done` after. One left
     * `sending` lost its answer: it is never sent again (F5 V10).
     */
    provider_parts: model.json().nullable(),
  })
  .indexes([{ on: ["order_id", "status"] }])
