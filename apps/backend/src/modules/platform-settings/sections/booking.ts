import { z } from "@medusajs/framework/zod"
import { defineSection, isCleanText } from "./define"

/**
 * The simple path of dated products (adr/0076 Ek basit yol): a shop that
 * sells a date and runs the rest by phone or e-mail turns the detailed
 * flows off. Off, their traces go (the voucher's button, page and code;
 * the shopper's online cancel) and the shop's own note shows instead.
 * Defaults keep the detailed flow. Read only while `catalog.booking` is
 * on (`lib/booking/flow.ts`); with it off the values are ignored.
 */
export interface BookingFlowSettings {
  /** Off: no voucher code, page or e-mail button; the note goes in the e-mail. */
  voucher_enabled: boolean
  /** The shop's words in place of the voucher; null: the default sentence. */
  voucher_off_note: string | null
  /** Off: the shopper cannot cancel online (`booking.cancel_by_contact`); staff still can. */
  online_cancel_enabled: boolean
  /** The shop's words in place of the cancel; null: the default sentence. */
  cancel_off_note: string | null
}

export const BOOKING_NOTE_MAX = 500

const note = z
  .string()
  .trim()
  .max(BOOKING_NOTE_MAX)
  .refine((value) => isCleanText(value), { message: "platform_settings.text_invalid" })
  .transform((value) => (value === "" ? null : value))
  .nullable()

export const bookingFlowSection = defineSection<BookingFlowSettings>(
  "booking",
  {
    voucher_enabled: z.boolean(),
    voucher_off_note: note,
    online_cancel_enabled: z.boolean(),
    cancel_off_note: note,
  },
  {
    voucher_enabled: true,
    voucher_off_note: null,
    online_cancel_enabled: true,
    cancel_off_note: null,
  }
)
