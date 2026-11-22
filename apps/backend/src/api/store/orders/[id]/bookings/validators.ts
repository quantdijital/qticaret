import { z } from "@medusajs/framework/zod"

/** A departure's id as the module makes them. */
export const SLOT_ID = /^bkslot_[A-Za-z0-9]{1,40}$/

/**
 * POST /store/orders/:id/bookings/cancel: the departure only. What comes
 * back is worked out on the server from the tiers (adr/0076 §8); an
 * amount, a percent or a mode is refused.
 */
export const StorePostBookingCancel = z
  .object({ slot_id: z.string().regex(SLOT_ID, "booking.slot_unknown") })
  .strict()
export type StorePostBookingCancelType = z.infer<typeof StorePostBookingCancel>
