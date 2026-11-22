import { z } from "@medusajs/framework/zod"

const id = z.string().min(1).max(64)

// Price categories one request may name; a product has a handful
export const BOOKING_ITEMS_MAX = 20

/**
 * A departure's places in the cart (adr/0076 §5, K6): the departure and
 * how many of each price category. No price, no date, no person count,
 * no `qt_` record: the server works those out (rule 5); anything else in
 * the body is refused.
 */
export const StorePostCartBooking = z
  .object({
    slot_id: id,
    items: z
      .array(
        z
          .object({
            variant_id: id,
            quantity: z.number().int().min(1).max(100),
          })
          .strict()
      )
      .min(1)
      .max(BOOKING_ITEMS_MAX),
  })
  .strict()

export type StorePostCartBookingType = z.infer<typeof StorePostCartBooking>
