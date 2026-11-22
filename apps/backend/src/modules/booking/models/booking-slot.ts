import { model } from "@medusajs/framework/utils"

export const SLOT_STATUSES = ["open", "closed", "cancelled"] as const

/**
 * A departure (adr/0076 §3): its places are this row's counters, the only
 * owner of the capacity (K2). `held` is what carts hold now, `sold` what
 * orders took; both change in one conditional statement (the service), and
 * the checks keep them inside the capacity whatever runs at once.
 * `price_adjustments`: variant id → a difference in kuruş on the variant's
 * own price for this departure (§4); the server prices the line (D3).
 */
export const BookingSlot = model
  .define("booking_slot", {
    id: model.id({ prefix: "bkslot" }).primaryKey(),
    bookable_id: model.text(),
    starts_at: model.dateTime(),
    ends_at: model.dateTime().nullable(),
    capacity: model.number(),
    sold: model.number().default(0),
    held: model.number().default(0),
    status: model.enum([...SLOT_STATUSES]).default("open"),
    price_adjustments: model.json().nullable(),
  })
  .indexes([{ on: ["bookable_id", "starts_at"] }])
  .checks([
    { name: "booking_slot_counts_check", expression: "sold + held <= capacity" },
    { name: "booking_slot_nonnegative_check", expression: "sold >= 0 AND held >= 0" },
  ])
