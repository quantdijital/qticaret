import { model } from "@medusajs/framework/utils"
import { REMINDER_KINDS } from "@qticaret/types/control-plane"

/** What became of a reminder once claimed (Ek C16). */
export const REMINDER_OUTCOMES = ["pending", "sent", "skipped", "failed"] as const
export type ReminderOutcome = (typeof REMINDER_OUTCOMES)[number]

/**
 * A payment reminder (adr/0061 §2 `reminder`, §7): one per charge and kind,
 * ever. The row is written before the e-mail leaves (insert first, unique
 * `(charge_id, kind)`): of two runs only the one that wrote it sends, and a
 * reminder that failed is not sent again (at most once, never twice). Who
 * it went to is not kept: the contact's address may change; the row says
 * only that it went, and how.
 */
export const Reminder = model
  .define("reminder", {
    id: model.id({ prefix: "rem" }).primaryKey(),
    charge_id: model.text(),
    tenant_id: model.text(),
    kind: model.enum([...REMINDER_KINDS]),
    channel: model.text().default("email"),
    outcome: model.enum([...REMINDER_OUTCOMES]).default("pending"),
    /** Why it did not go (`billing.mail_off`, `billing.no_contact`, `billing.mail_failed`). */
    error_code: model.text().nullable(),
    sent_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["charge_id", "kind"], unique: true, where: "deleted_at IS NULL" },
    { on: ["tenant_id", "created_at"], where: "deleted_at IS NULL" },
  ])
