import { model } from "@medusajs/framework/utils"

/**
 * Whether a recipient takes commercial messages on a channel (adr/0036,
 * İYS's counterpart): the current answer, found by the address's keyed
 * hash. Every change is also kept in `message_consent_event`, the proof
 * of when and how it was given or withdrawn. The address is kept
 * encrypted too, only to tell İYS (F10 M11).
 */
export const MessageConsent = model
  .define("message_consent", {
    id: model.id({ prefix: "mcons" }).primaryKey(),
    channel: model.enum(["email", "sms", "call"]),
    recipient_hash: model.text(),
    recipient_masked: model.text(),
    recipient_encrypted: model.text().nullable(),
    customer_id: model.text().nullable(),
    status: model.enum(["granted", "revoked"]),
    source: model.enum(["checkout", "account", "panel", "import", "iys", "unsubscribe"]),
    changed_at: model.dateTime(),
    /** The staff member who changed it from the panel; null when the recipient did. */
    changed_by: model.text().nullable(),
    /** Whether İYS has been told (F10); `not_required` for a business's own records. */
    iys_status: model.enum(["pending", "sent", "failed", "not_required"]).default("pending"),
    /** İYS's refusal (`iys_70`), when it did not take the change. */
    iys_error: model.text().nullable(),
    iys_sent_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["channel", "recipient_hash"], unique: true, where: "deleted_at IS NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL" },
    { on: ["iys_status", "changed_at"], where: "deleted_at IS NULL" },
  ])
