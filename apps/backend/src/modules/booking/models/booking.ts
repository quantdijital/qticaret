import { model } from "@medusajs/framework/utils"

export const BOOKING_STATUSES = ["confirmed", "cancelled", "completed"] as const

/**
 * A confirmed booking (adr/0076 §3): an order's places, moved from the
 * cart's hold to `sold`. `hold_id` is the hold it came from, unique, so
 * confirming the same hold again finds this row and changes nothing.
 * Its slots and units in `booking_slot_use`. Travelers come in D6.
 */
export const Booking = model
  .define("booking", {
    id: model.id({ prefix: "bkng" }).primaryKey(),
    order_id: model.text(),
    line_item_id: model.text().nullable(),
    hold_id: model.text(),
    status: model.enum([...BOOKING_STATUSES]).default("confirmed"),
  })
  .indexes([{ on: ["hold_id"], unique: true }, { on: ["order_id"] }])

/**
 * A booking's places on one slot. `cancelled_at`: this departure alone
 * was cancelled (adr/0076 D7a: the shopper's, staff's or the shop's
 * whole departure), its places given back; the booking stays confirmed
 * while another of its departures is not.
 */
export const BookingSlotUse = model
  .define("booking_slot_use", {
    id: model.id({ prefix: "bkuse" }).primaryKey(),
    booking_id: model.text(),
    slot_id: model.text(),
    units: model.number(),
    cancelled_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["booking_id", "slot_id"], unique: true }, { on: ["slot_id"] }])
  .checks([{ name: "booking_slot_use_units_check", expression: "units > 0" }])
