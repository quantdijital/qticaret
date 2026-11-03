import { model } from "@medusajs/framework/utils"

export const RECIPIENT_STATUSES = ["pending", "sent", "skipped", "failed"] as const
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number]

/**
 * One person a campaign goes to (adr/0050 §2), fixed when it starts: the
 * keyed hash the consent records use, and the customer or consent record
 * the address is read from at send time. No address is kept. Gone 90 days
 * after the campaign ends (the counts stay), or with a KVKK erasure.
 */
export const BulkMessageRecipient = model
  .define("bulk_message_recipient", {
    id: model.id({ prefix: "camprc" }).primaryKey(),
    campaign_id: model.text(),
    recipient_hash: model.text(),
    source: model.enum(["customer", "consent"]),
    /** The customer's or the consent's id. */
    source_id: model.text(),
    customer_id: model.text().nullable(),
    status: model.enum([...RECIPIENT_STATUSES]).default("pending"),
    /** Why it was skipped or failed: deliver()'s outcome. */
    reason: model.text().nullable(),
    sent_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["campaign_id", "recipient_hash"], unique: true, where: "deleted_at IS NULL" },
    { on: ["campaign_id", "status"], where: "deleted_at IS NULL" },
    { on: ["sent_at"], where: "deleted_at IS NULL AND sent_at IS NOT NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL AND customer_id IS NOT NULL" },
  ])
