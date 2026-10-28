import { model } from "@medusajs/framework/utils"

/**
 * Whether a recipient takes commercial messages on a channel (adr/0036,
 * İYS's counterpart): the current answer, found by the address's keyed
 * hash. Every change is also kept in `message_consent_event`, the proof
 * of when and how it was given or withdrawn.
 */
export const MessageConsent = model
  .define("message_consent", {
    id: model.id({ prefix: "mcons" }).primaryKey(),
    channel: model.enum(["email", "sms", "call"]),
    recipient_hash: model.text(),
    recipient_masked: model.text(),
    customer_id: model.text().nullable(),
    status: model.enum(["granted", "revoked"]),
    source: model.enum(["checkout", "account", "panel", "import", "iys"]),
    changed_at: model.dateTime(),
    /** The staff member who changed it from the panel; null when the recipient did. */
    changed_by: model.text().nullable(),
    /** Whether İYS has been told (F10); `not_required` for a business's own records. */
    iys_status: model.enum(["pending", "sent", "failed", "not_required"]).default("pending"),
  })
  .indexes([
    { on: ["channel", "recipient_hash"], unique: true, where: "deleted_at IS NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL" },
  ])
