import { model } from "@medusajs/framework/utils"

/**
 * An address no message goes to (adr/0036): a hard bounce or a spam
 * complaint the provider reported, or the shop's own choice. Removing it
 * from the list keeps the row (soft delete) with who removed it.
 */
export const MessageSuppression = model
  .define("message_suppression", {
    id: model.id({ prefix: "msup" }).primaryKey(),
    channel: model.enum(["email", "sms"]),
    recipient_hash: model.text(),
    recipient_masked: model.text(),
    reason: model.enum(["bounce", "complaint", "manual"]),
    source: model.enum(["resend", "netgsm", "panel", "smtp"]),
    /** The provider's short word for it (`Permanent`, `General`), never its message. */
    detail: model.text().nullable(),
    created_by: model.text().nullable(),
    removed_by: model.text().nullable(),
  })
  .indexes([{ on: ["channel", "recipient_hash"], unique: true, where: "deleted_at IS NULL" }])
