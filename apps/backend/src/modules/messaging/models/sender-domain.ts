import { model } from "@medusajs/framework/utils"

/**
 * The shop's own sender domain (adr/0036 §6): added to the platform's
 * Resend account, verified once its DNS records are published. Until
 * then e-mail goes from the platform's address. One row at a time.
 */
export const SenderDomain = model.define("sender_domain", {
  id: model.id({ prefix: "sdom" }).primaryKey(),
  /** `magaza.com.tr`, lower case. */
  name: model.text(),
  /** The address's part before `@`: `bildirim`. */
  local_part: model.text().default("bildirim"),
  resend_id: model.text(),
  status: model.enum(["not_started", "pending", "verified", "failure", "temporary_failure"]),
  /** The DNS records Resend wants, as it last gave them. */
  records: model.json(),
  checked_at: model.dateTime().nullable(),
  verified_at: model.dateTime().nullable(),
})
