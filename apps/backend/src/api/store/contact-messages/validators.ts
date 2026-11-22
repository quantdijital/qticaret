import { z } from "@medusajs/framework/zod"
import { normalizeTrPhone } from "../../../lib/tr/phone"
import { CONTACT_FORM_SUBJECTS } from "../../../modules/contact-messages/models/contact-message"

// Text as typed, without control characters other than line breaks
const plain = (value: string): string => value.replace(/[^\P{Cc}\n]/gu, "").trim()
const oneLine = (value: string): string => plain(value).replace(/\s+/g, " ")

/**
 * A contact form message (F18 D10, adr/0047). The phone is optional and
 * Turkish; the order number is what the shopper sees on their order.
 */
export const StorePostContactMessage = z
  .object({
    name: z.string().transform(oneLine).pipe(z.string().min(2).max(100)),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    phone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((value, context) => {
        if (!value) {
          return null
        }
        const phone = normalizeTrPhone(value)
        if (!phone) {
          context.addIssue({ code: "custom", message: "contact_messages.phone_invalid" })
          return z.NEVER
        }
        return phone
      }),
    subject: z.enum(CONTACT_FORM_SUBJECTS),
    order_number: z
      .string()
      .trim()
      .regex(/^#?\d{1,12}$/)
      .transform((value) => value.replace(/^#/, ""))
      .optional()
      .transform((value) => value ?? null),
    body: z.string().transform(plain).pipe(z.string().min(10).max(3000)),
  })
  .strict()
export type StorePostContactMessageType = z.infer<typeof StorePostContactMessage>
