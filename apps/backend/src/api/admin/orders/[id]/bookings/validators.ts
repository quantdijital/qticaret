import { z } from "@medusajs/framework/zod"
import { SLOT_ID } from "../../../../store/orders/[id]/bookings/validators"

/** Staff's choice (adr/0076 Ek D7a): the product's tier, or all of it back. */
const mode = z.enum(["tier", "full"])

/** GET /admin/orders/:id/bookings: the departures with each cancel's refund under `mode`. */
export const AdminGetOrderBookings = z.object({ mode: mode.default("tier") }).strict()
export type AdminGetOrderBookingsType = z.infer<typeof AdminGetOrderBookings>

/** POST /admin/orders/:id/bookings/cancel: the departure and the mode; never an amount. */
export const AdminPostOrderBookingCancel = z
  .object({ slot_id: z.string().regex(SLOT_ID, "booking.slot_unknown"), mode })
  .strict()
export type AdminPostOrderBookingCancelType = z.infer<typeof AdminPostOrderBookingCancel>
