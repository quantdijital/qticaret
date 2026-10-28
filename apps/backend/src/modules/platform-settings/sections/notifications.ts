import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface NotificationSettings {
  /** Staff who get the shop's alerts by e-mail; none: the panel's bell only. */
  staff_emails: string[]
  alert_new_order: boolean
  /** An order placed with bank transfer waits for the shop to confirm the money. */
  alert_bank_transfer: boolean
  alert_low_stock: boolean
  /** Monday morning's summary of the shop's SEO (docs/14). */
  alert_seo_digest: boolean
}

/** Who on the staff hears of what by e-mail (F9.7, adr/0036); the bell shows alerts anyway. */
export const notificationsSection = defineSection<NotificationSettings>(
  "notifications",
  {
    staff_emails: z
      .array(z.email({ error: "platform_settings.email_invalid" }).max(254))
      .max(5)
      .refine(
        (emails) => new Set(emails.map((each) => each.toLowerCase())).size === emails.length,
        {
          message: "platform_settings.email_duplicate",
        }
      ),
    alert_new_order: z.boolean(),
    alert_bank_transfer: z.boolean(),
    alert_low_stock: z.boolean(),
    alert_seo_digest: z.boolean(),
  },
  {
    staff_emails: [],
    alert_new_order: true,
    alert_bank_transfer: true,
    alert_low_stock: true,
    alert_seo_digest: true,
  }
)
