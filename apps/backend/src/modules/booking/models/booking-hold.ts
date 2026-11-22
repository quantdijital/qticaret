import { model } from "@medusajs/framework/utils"

/**
 * A cart's places held for a while (adr/0076 §5), one row a cart; its
 * slots and units in `booking_hold_slot` (a list, so a stay of three
 * nights is three rows, K4). Counted in each slot's `held` until it is
 * confirmed, released or swept once `expires_at` passes; reads leave an
 * expired one out before the sweep comes.
 */
export const BookingHold = model
  .define("booking_hold", {
    id: model.id({ prefix: "bkhold" }).primaryKey(),
    cart_id: model.text(),
    expires_at: model.dateTime(),
  })
  .indexes([{ on: ["cart_id"], unique: true }, { on: ["expires_at"] }])

/** A hold's places on one slot. */
export const BookingHoldSlot = model
  .define("booking_hold_slot", {
    id: model.id({ prefix: "bkhslot" }).primaryKey(),
    hold_id: model.text(),
    slot_id: model.text(),
    units: model.number(),
  })
  .indexes([{ on: ["hold_id", "slot_id"], unique: true }, { on: ["slot_id"] }])
  .checks([{ name: "booking_hold_slot_units_check", expression: "units > 0" }])
