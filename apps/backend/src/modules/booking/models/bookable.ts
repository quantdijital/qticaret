import { model } from "@medusajs/framework/utils"

export const BOOKING_MODES = ["departure", "range"] as const

/**
 * How a dated product is sold (adr/0076 Ek 2026-11-23): `online` through
 * the cart, `request` only by a "call me" request (no payment, no places
 * taken), `both` the cart with the request beside it.
 */
export const SALE_MODES = ["online", "request", "both"] as const

/**
 * A dated product's booking settings (adr/0076 §3), one row a product,
 * linked to it (`links/product-bookable.ts`); `product_id` keeps two first
 * saves from making two rows. Only `departure` is written today (§11).
 * - `cutoff_hours`: sales close this long before a departure;
 * - `hold_minutes`: how long a cart holds its places (10-60, §5);
 * - `max_units_per_cart`: the most places one cart may hold (§13);
 * - `min_participants`: the departure runs from this many (null: any);
 * - `traveler_fields`, `cancellation_tiers`: read by later slices (D6, D7),
 *   their shapes in `lib/booking/settings`;
 * - `pax_by_variant`: variant id → how many places a unit takes and the
 *   ages it is for (§4: a variant is a price category, not a date);
 * - `timezone`: the zone the shop sets departures in;
 * - `sale_mode`: sold online, by a call-me request, or both.
 * No personal data.
 */
export const Bookable = model
  .define("bookable", {
    id: model.id({ prefix: "bkbl" }).primaryKey(),
    product_id: model.text(),
    mode: model.enum([...BOOKING_MODES]).default("departure"),
    cutoff_hours: model.number().default(0),
    hold_minutes: model.number().default(20),
    max_units_per_cart: model.number().default(20),
    min_participants: model.number().nullable(),
    traveler_fields: model.json().nullable(),
    cancellation_tiers: model.json().nullable(),
    pax_by_variant: model.json().nullable(),
    timezone: model.text().default("Europe/Istanbul"),
    // adr/0076 Ek D7b: the reminder goes this many days before a departure; 0 sends none
    reminder_days: model.number().default(2),
    // adr/0076 Ek 2026-11-23: online (today's way), request only, or both
    sale_mode: model.enum([...SALE_MODES]).default("online"),
    // adr/0078: the ordered steps the page shows (`lib/booking/program`); null: none
    program: model.json().nullable(),
  })
  .indexes([{ on: ["product_id"], unique: true }])
  .checks([
    { name: "bookable_reminder_days_check", expression: "reminder_days BETWEEN 0 AND 30" },
    { name: "bookable_hold_minutes_check", expression: "hold_minutes BETWEEN 10 AND 60" },
    { name: "bookable_cutoff_hours_check", expression: "cutoff_hours >= 0" },
    { name: "bookable_max_units_check", expression: "max_units_per_cart >= 1" },
  ])
