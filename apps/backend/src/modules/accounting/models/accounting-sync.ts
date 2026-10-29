import { model } from "@medusajs/framework/utils"

export const SYNC_SOURCES = ["sale", "payment", "refund", "cancel"] as const
export const SYNC_STATUSES = ["pending", "synced", "stopped", "skipped"] as const

/**
 * One record sent to the shop's accounting program (F11.5, adr/0039 §5):
 * a sale (an order), a payment (a capture), a refund, or a sale's
 * cancellation (the order, canceled), once per program. Tried again later
 * and later until it goes through; after MAX_ATTEMPTS it stops and staff
 * are told. One with nothing to send (a sale canceled before it went, an
 * order in another currency) is skipped, its reason in `last_error`. Its
 * id is the reference the program dedupes on.
 */
export const AccountingSync = model
  .define("accounting_sync", {
    id: model.id({ prefix: "acsync" }).primaryKey(),
    adapter: model.text(),
    source_type: model.enum([...SYNC_SOURCES]),
    source_id: model.text(),
    status: model.enum([...SYNC_STATUSES]).default("pending"),
    attempts: model.number().default(0),
    /** When it may be tried next; a claim pushes it on while it is being sent. */
    next_attempt_at: model.dateTime(),
    /** The program's id for it, once sent. */
    external_ref: model.text().nullable(),
    /** The program's or the platform's code only: never a message that may quote data. */
    last_error: model.text().nullable(),
    synced_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["source_type", "source_id", "adapter"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status", "next_attempt_at"] },
  ])
