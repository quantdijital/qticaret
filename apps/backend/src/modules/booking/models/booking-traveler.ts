import { model } from "@medusajs/framework/utils"

/**
 * A traveler on a departure (adr/0076 §7, K8), as many per departure as
 * the cart's places on it. Written against the cart while the shopper
 * fills checkout; the order's confirmation sets `booking_id`. The name,
 * the birth date and the nationality (ISO 3166-1 alpha-2) are kept plain;
 * an ID or passport number only encrypted (bound to the cart), as a keyed
 * hash and its last four characters (adr/0009). Never in a line's
 * metadata, a log, an invoice, a payment provider or an AI service.
 * `purge_after`: the service's date plus the period travelers are kept;
 * the nightly retention deletes the row then (`compliance-retention`).
 */
export const BookingTraveler = model
  .define("booking_traveler", {
    id: model.id({ prefix: "bktrv" }).primaryKey(),
    cart_id: model.text(),
    slot_id: model.text(),
    booking_id: model.text().nullable(),
    position: model.number(),
    first_name: model.text(),
    last_name: model.text(),
    birth_date: model.text().nullable(),
    nationality: model.text().nullable(),
    document_encrypted: model.text().nullable(),
    document_hash: model.text().nullable(),
    document_last4: model.text().nullable(),
    key_version: model.number().nullable(),
    purge_after: model.dateTime(),
  })
  .indexes([
    { on: ["cart_id", "slot_id", "position"], unique: true },
    { on: ["booking_id"] },
    { on: ["slot_id"] },
    { on: ["purge_after"] },
    { on: ["document_hash"] },
  ])
  .checks([{ name: "booking_traveler_position_check", expression: "position >= 0" }])
