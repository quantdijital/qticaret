import { z } from "@medusajs/framework/zod"
import { BookableSettings, PriceAdjustments } from "../../../lib/booking/settings"
import { SLOT_STATUSES } from "../../../modules/booking/models/booking-slot"

/** An ISO 8601 moment with its offset (`2027-05-01T09:00:00+03:00`). */
const moment = z.iso.datetime({ offset: true }).transform((text) => new Date(text))

// The most places a departure has; a typo past this, not a departure
const capacity = z.number().int().min(0).max(10_000)

/** POST /admin/products/:id/bookable: a dated product's settings (adr/0076 §3). */
export const AdminPostBookable = BookableSettings
export type AdminPostBookableType = z.infer<typeof AdminPostBookable>

const NewSlot = z
  .object({
    starts_at: moment,
    ends_at: moment.nullable().optional(),
    capacity,
    status: z.enum(SLOT_STATUSES).optional(),
    // A difference on a variant's price for this departure, in lira; the server prices lines
    price_adjustments: PriceAdjustments.nullable().optional(),
  })
  .strict()

/** POST /admin/products/:id/booking-slots: up to a hundred departures at once. */
export const AdminPostBookingSlots = z.object({ slots: z.array(NewSlot).min(1).max(100) }).strict()
export type AdminPostBookingSlotsType = z.infer<typeof AdminPostBookingSlots>

/** GET /admin/products/:id/booking-slots: from a moment on, by start. */
export const AdminGetBookingSlots = z
  .object({
    from: moment.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  })
  .strict()
export type AdminGetBookingSlotsType = z.infer<typeof AdminGetBookingSlots>

/** POST /admin/booking-slots/:id: a departure's own fields; never its counters. */
export const AdminPostBookingSlot = z
  .object({
    capacity: capacity.optional(),
    status: z.enum(SLOT_STATUSES).optional(),
    starts_at: moment.optional(),
    ends_at: moment.nullable().optional(),
    price_adjustments: PriceAdjustments.nullable().optional(),
  })
  .strict()
export type AdminPostBookingSlotType = z.infer<typeof AdminPostBookingSlot>
