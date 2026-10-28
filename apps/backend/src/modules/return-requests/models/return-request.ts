import { model } from "@medusajs/framework/utils"
import { RETURN_REASONS, RETURN_STATUSES } from "../states"

/**
 * A shopper's request to send an order back (F7.9, adr/0032), from the
 * request to the refund: which lines, why, the shop's decision, the
 * carrier's return code, what came back and what was refunded. No address
 * or name: the order holds those. Amounts in kuruş.
 */
export const ReturnRequest = model
  .define("return_request", {
    id: model.id({ prefix: "rreq" }).primaryKey(),
    order_id: model.text(),
    customer_id: model.text().nullable(),
    status: model.enum([...RETURN_STATUSES]).default("requested"),
    reason: model.enum([...RETURN_REASONS]),
    /** The shopper's own words. */
    note: model.text().nullable(),
    /** The lines asked for: `[{ line_item_id, quantity }]`. */
    items: model.json(),
    decision_note: model.text().nullable(),
    decided_by: model.text().nullable(),
    decided_at: model.dateTime().nullable(),
    /** Medusa's return, opened on approval. */
    return_id: model.text().nullable(),
    /** The carrier's code the shopper hands the parcel over with, and its tracking. */
    return_code: model.text().nullable(),
    return_shipment_id: model.text().nullable(),
    return_label_file_id: model.text().nullable(),
    /** The lines that came back: `[{ line_item_id, quantity }]`. */
    received_items: model.json().nullable(),
    received_at: model.dateTime().nullable(),
    refund_amount: model.number().nullable(),
    refund_reference: model.text().nullable(),
  })
  .indexes([
    { on: ["order_id"] },
    { on: ["status", "created_at"] },
    // One request being dealt with per order, whatever races to open a second
    {
      on: ["order_id"],
      unique: true,
      where: "status IN ('requested', 'approved')",
    },
  ])
