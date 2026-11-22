import { BOOKING_KEY } from "../../../lib/booking/cart-lines"
import { cartItemsOf } from "../cart/plan"
import type { CartBookingPlan } from "../cart/plan"
import { holdMatches, minutesLeft } from "../cart/review"
import type { SlotLines } from "../cart/review"

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
