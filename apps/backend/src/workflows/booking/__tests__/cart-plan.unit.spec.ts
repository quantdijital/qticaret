import type { MedusaContainer } from "@medusajs/framework/types"
import { BOOKING_KEY } from "../../../lib/booking/cart-lines"
import { cartItemsOf } from "../cart/plan"
import type { CartBookingPlan } from "../cart/plan"
import { holdMatches, minutesLeft } from "../cart/review"
import type { SlotLines } from "../cart/review"
import { priceBookingLine } from "../cart/target"
import type { BookingTarget } from "../cart/target"
import type { AddonCart } from "../../addons/cart"

const plan: CartBookingPlan = {
  cart_id: "cart_1",
  slot_id: "bkslot_1",
  starts_at: "2026-12-01T09:00:00.000Z",
  units: 3,
  units_before: 0,
  hold_minutes: 20,
  lines: [
    {
      variant_id: "variant_a",
      quantity: 2,
      unit_price: "1750",
      compare_at_unit_price: null,
      is_tax_inclusive: true,
      pax: 1,
    },
    {
      variant_id: "variant_i",
      quantity: 1,
      unit_price: "0",
      compare_at_unit_price: "100",
      is_tax_inclusive: true,
      pax: 0,
    },
  ],
  replaced_line_ids: [],
  client: { hash: "a1b2c3", maxPerSlot: 10 },
}

const slot = (slotId: string, units: number) => ({ slot_id: slotId, units }) as SlotLines

describe("a booking request's lines (adr/0076 §5)", () => {
  it("adds lines at the server's price, marked with the hold, the departure and its pax", () => {
    const items = cartItemsOf(plan, "bkhold_1")

    expect(items).toEqual([
      {
        variant_id: "variant_a",
        quantity: 2,
        unit_price: "1750",
        is_tax_inclusive: true,
        metadata: {
          [BOOKING_KEY]: {
            hold_id: "bkhold_1",
            slot_id: "bkslot_1",
            starts_at: "2026-12-01T09:00:00.000Z",
            pax: 1,
          },
        },
      },
      expect.objectContaining({ unit_price: "0", compare_at_unit_price: "100" }),
    ])
  })

  it("matches a hold only when it keeps exactly the lines' places, slot by slot", () => {
    const hold = {
      hold_id: "bkhold_1",
      expires_at: new Date(),
      live: true,
      slots: [
        { slotId: "bkslot_1", units: 3 },
        { slotId: "bkslot_2", units: 2 },
      ],
    }

    expect(holdMatches(hold, [slot("bkslot_1", 3), slot("bkslot_2", 2)])).toBe(true)
    expect(holdMatches(hold, [slot("bkslot_1", 3)])).toBe(false)
    expect(holdMatches(hold, [slot("bkslot_1", 2), slot("bkslot_2", 2)])).toBe(false)
    // A slot whose lines take no place (infants only) needs nothing held
    expect(
      holdMatches({ ...hold, slots: [{ slotId: "bkslot_1", units: 3 }] }, [
        slot("bkslot_1", 3),
        slot("bkslot_3", 0),
      ])
    ).toBe(true)
  })

  it("keeps a hold's end when it changes: its minutes left, 1 to 120", () => {
    const now = Date.parse("2026-11-22T10:00:00Z")
    const at = (minutes: number) => ({
      hold_id: "h",
      expires_at: new Date(now + minutes * 60_000),
      live: true,
      slots: [],
    })

    expect(minutesLeft(at(12.5), now)).toBe(13)
    expect(minutesLeft(at(0.1), now)).toBe(1)
    expect(minutesLeft(at(-5), now)).toBe(1)
    expect(minutesLeft(at(500), now)).toBe(120)
  })
})

describe("a dated line's price (adr/0076 §4, Ek kalkış fiyatı promosyonlu)", () => {
  // A sale list: 1.200 TL now, 1.500 TL before it
  const container = {
    resolve: () => ({
      graph: () =>
        Promise.resolve({
          data: [
            {
              calculated_price: {
                calculated_amount: 1200,
                original_amount: 1500,
                is_calculated_price_tax_inclusive: true,
              },
            },
          ],
        }),
    }),
  } as unknown as MedusaContainer
  const cart: AddonCart = { id: "cart_1", currency_code: "try", region_id: "reg_1" }
  const departure = (adjustments: Record<string, number> | null) =>
    ({
      slot: { price_adjustments: adjustments },
      bookable: {},
      product: { id: "prod_1", variantIds: ["variant_a"] },
    }) as unknown as BookingTarget

  it("strikes the sale's price through on a departure without a difference", async () => {
    const price = await priceBookingLine(container, cart, departure(null), "variant_a", 1)

    expect(price).toEqual({
      unit_price: 120000,
      compare_at_unit_price: 150000,
      is_tax_inclusive: true,
    })
  })

  it("strikes nothing through on a departure with a difference, and charges the same", async () => {
    const raised = await priceBookingLine(
      container,
      cart,
      departure({ variant_a: 25050 }),
      "variant_a",
      2
    )
    const cut = await priceBookingLine(
      container,
      cart,
      departure({ variant_a: -50000 }),
      "variant_a",
      1
    )

    // The charged price is the sale's plus the difference, as before; the one before is the line's own
    expect(raised).toEqual({
      unit_price: 145050,
      compare_at_unit_price: 145050,
      is_tax_inclusive: true,
    })
    expect(cut).toMatchObject({ unit_price: 70000, compare_at_unit_price: 70000 })
  })
})
