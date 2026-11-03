import { model } from "@medusajs/framework/utils"
import { RETURN_KINDS, RETURN_REASONS, RETURN_STATUSES } from "../states"

/**
 * A shopper's request to send an order back (F7.9, adr/0032), from the
 * request to the refund: which lines, why, the shop's decision, the
 * carrier's return code and its handover, what came back (or was refused)
 * and what was refunded. No address
 * or name: the order holds those. Amounts in kuruş.
 */
export const ReturnRequest = model
  .define("return_request", {
    id: model.id({ prefix: "rreq" }).primaryKey(),
    order_id: model.text(),
    customer_id: model.text().nullable(),
    kind: model.enum([...RETURN_KINDS]).default("return"),
    status: model.enum([...RETURN_STATUSES]).default("requested"),
    reason: model.enum([...RETURN_REASONS]),
    /** The shopper's own words. */
    note: model.text().nullable(),
    /** The lines asked for: `[{ line_item_id, quantity }]`. */
    items: model.json(),
    /** An exchange's wanted variants: `[{ line_item_id, variant_id, quantity }]`. */
    exchange_items: model.json().nullable(),
    /**
     * An exchange's cost in kuruş, positive when the shopper owes: as
     * quoted when asked, as Medusa confirmed it once approved.
     */
    difference: model.number().nullable(),
    /** Medusa's exchange, opened on approval. */
    exchange_id: model.text().nullable(),
    decision_note: model.text().nullable(),
    decided_by: model.text().nullable(),
    decided_at: model.dateTime().nullable(),
    /** Medusa's return, opened on approval. */
    return_id: model.text().nullable(),
    /** The carrier's code the shopper hands the parcel over with, and its tracking. */
    return_code: model.text().nullable(),
    return_shipment_id: model.text().nullable(),
    return_label_file_id: model.text().nullable(),
    /** The lines that came back sound, back in stock: `[{ line_item_id, quantity }]`. */
    received_items: model.json().nullable(),
    /** The lines that came back broken, refunded but never restocked. */
    damaged_items: model.json().nullable(),
    /**
     * The refund gives the order's outbound shipping back: a withdrawal's
     * by law (MSY md. 12/1), a faulty item's by the staff's call (adr/0032
     * §5, Ek 2026-11-03). Set on receipt, on the one request that gives it.
     */
    refund_shipping: model.boolean().default(false),
    /**
     * Units sent back but refused at receipt, never refunded nor asked
     * again: a hygiene good opened (MSY md. 15/1-ç),
     * `[{ line_item_id, quantity, reason: "unsealed" }]`.
     */
    refused_items: model.json().nullable(),
    /**
     * When the return carrier took the parcel, from its tracking: the law's
     * 14 days to refund run from here (MSY md. 12/1). Null until seen, or
     * when it went another way (the days then run from `received_at`).
     */
    handed_over_at: model.dateTime().nullable(),
    received_at: model.dateTime().nullable(),
    /** When staff were told the refund's deadline nears (`returns.refund_deadline_near`), once. */
    refund_alerted_at: model.dateTime().nullable(),
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
