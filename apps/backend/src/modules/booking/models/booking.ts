import { model } from "@medusajs/framework/utils"

export const BOOKING_STATUSES = ["confirmed", "cancelled", "completed"] as const

/**
 * How a departure's cancel gave its money back (refund safety follow-up of
 * adr/0076): `sent` by the provider, `none` due, or left to staff
 * (`offline`, `credit`, `exceeds`).
 */
export const CANCEL_REFUNDS = ["sent", "none", "offline", "credit", "exceeds"] as const
export type CancelRefundWay = (typeof CANCEL_REFUNDS)[number]

/**
 * A confirmed booking (adr/0076 §3): an order's places, moved from the
 * cart's hold to `sold`. `hold_id` is the hold it came from, unique, so
 * confirming the same hold again finds this row and changes nothing.
 * Its slots and units in `booking_slot_use`. Travelers come in D6.
 * `voucher_code`: the voucher's check code (adr/0076 Ek D7b), 80 random
 * bits made on first read (`ensureVoucher`), unique; no personal data.
 */
export const Booking = model
  .define("booking", {
    id: model.id({ prefix: "bkng" }).primaryKey(),
    order_id: model.text(),
    line_item_id: model.text().nullable(),
    hold_id: model.text(),
    status: model.enum([...BOOKING_STATUSES]).default("confirmed"),
    voucher_code: model.text().nullable(),
  })
  .indexes([
    { on: ["hold_id"], unique: true },
    { on: ["order_id"] },
    { on: ["voucher_code"], unique: true, where: "voucher_code IS NOT NULL" },
  ])

/**
 * A booking's places on one slot. `cancelled_at`: this departure alone
 * was cancelled (adr/0076 D7a: the shopper's, staff's or the shop's
 * whole departure), its places given back; the booking stays confirmed
 * while another of its departures is not. `cancellation`: the product's
 * tiers and zone when the booking was confirmed (`{ timezone, tiers }`,
 * review O5); a cancel reckons by it, by the product's settings when null.
 * `reminded_at`: the departure's reminder went out (adr/0076 Ek D7b).
 * `cancel_refund`: how the cancel gave the money back (`CANCEL_REFUNDS`),
 * written with `cancelled_at`; null before it was kept, and while live.
 */
export const BookingSlotUse = model
  .define("booking_slot_use", {
    id: model.id({ prefix: "bkuse" }).primaryKey(),
    booking_id: model.text(),
    slot_id: model.text(),
    units: model.number(),
    cancelled_at: model.dateTime().nullable(),
    cancellation: model.json().nullable(),
    reminded_at: model.dateTime().nullable(),
    cancel_refund: model.enum([...CANCEL_REFUNDS]).nullable(),
  })
  .indexes([{ on: ["booking_id", "slot_id"], unique: true }, { on: ["slot_id"] }])
  .checks([{ name: "booking_slot_use_units_check", expression: "units > 0" }])
