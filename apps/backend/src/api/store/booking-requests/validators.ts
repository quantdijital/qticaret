import { z } from "@medusajs/framework/zod"
import { normalizeTrPhone } from "../../../lib/tr/phone"

// Text as typed, without control characters other than line breaks
const plain = (value: string): string => value.replace(/[^\P{Cc}\n]/gu, "").trim()
const oneLine = (value: string): string => plain(value).replace(/\s+/g, " ")

const id = z.string().trim().min(1).max(64)

/** A real calendar day, YYYY-MM-DD. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  })

/** A month, YYYY-MM. */
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

/**
 * A dated product's call-me request (adr/0076 Ek 2026-11-23): who to call
 * (the phone is required, the address optional), one departure, a day, a
 * month or none (open dates), how many people, a note, and the shopper's
 * consent to the privacy notice. The product's own limits (its sale mode,
 * the departure, its per-cart cap) are checked in the workflow.
 */
export const StorePostBookingRequest = z
  .object({
    product_id: id,
    name: z.string().transform(oneLine).pipe(z.string().min(2).max(100)),
    phone: z
      .string()
      .trim()
      .max(20)
      .transform((value, context) => {
        const phone = normalizeTrPhone(value)
        if (!phone) {
          context.addIssue({ code: "custom", message: "contact_messages.phone_invalid" })
          return z.NEVER
        }
        return phone
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .pipe(z.email().or(z.literal("")))
      .optional()
      .transform((value) => value ?? ""),
    slot_id: id.optional(),
    date: day.optional(),
    month: month.optional(),
    adults: z.number().int().min(1).max(500),
    children: z.number().int().min(0).max(500).optional(),
    note: z
      .string()
      .transform(plain)
      .pipe(z.string().max(1000))
      .optional()
      .transform((value) => value ?? ""),
    consent: z.literal(true),
  })
  .strict()
  .refine(
    (body) =>
      [body.slot_id, body.date, body.month].filter((value) => value !== undefined).length <= 1,
    { message: "booking.request_when_invalid", path: ["slot_id"] }
  )
export type StorePostBookingRequestType = z.infer<typeof StorePostBookingRequest>
