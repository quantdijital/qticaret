import { lifecycleOf } from "../lifecycle"
import type { LifecycleOrder } from "../lifecycle"

const paid = [{ status: "authorized", amount: 100, captured_amount: 0, refunded_amount: 0 }]
const line = (quantity: number, fulfilled = 0, shipped = 0, delivered = 0) => ({
  quantity,
  detail: {
    fulfilled_quantity: fulfilled,
    shipped_quantity: shipped,
    delivered_quantity: delivered,
  },
})
const order = (extra: Partial<LifecycleOrder> = {}): LifecycleOrder => ({
  status: "pending",
  currency_code: "try",
  payment_collections: paid,
  items: [line(2)],
  ...extra,
})

describe("lifecycleOf", () => {
  it("reads payment: held or taken is to ship, nothing yet is awaiting payment", () => {
    expect(lifecycleOf(order())).toBe("to_ship")
    expect(
      lifecycleOf(
        order({ payment_collections: [{ status: "not_paid", amount: 100, captured_amount: 0 }] })
      )
    ).toBe("awaiting_payment")
  })

  it("keeps a partly refunded, unsent order to ship", () => {
    const refunded = [
      { status: "partially_refunded", amount: 100, captured_amount: 100, refunded_amount: 20 },
    ]

    expect(lifecycleOf(order({ payment_collections: refunded }))).toBe("to_ship")
  })

  it("follows each item: something left keeps it to ship, all sent is shipped, all delivered is delivered", () => {
    expect(lifecycleOf(order({ items: [line(2, 2, 2), line(1)] }))).toBe("to_ship")
    expect(lifecycleOf(order({ items: [line(2, 2, 0)] }))).toBe("to_ship")
    expect(lifecycleOf(order({ items: [line(2, 2, 2, 1), line(1, 1, 1, 1)] }))).toBe("shipped")
    expect(lifecycleOf(order({ items: [line(2, 2, 2, 2), line(1, 1, 1, 1)] }))).toBe("delivered")
  })

  it("puts a canceled order first", () => {
    expect(lifecycleOf(order({ status: "canceled", items: [line(1, 1, 1, 1)] }))).toBe("canceled")
  })

  it("counts lines that need no shipping as done once paid (F3.2)", () => {
    const digital = { ...line(1), requires_shipping: false }
    const unpaid = [{ status: "not_paid", amount: 10, captured_amount: 0 }]

    expect(lifecycleOf(order({ items: [digital] }))).toBe("delivered")
    expect(lifecycleOf(order({ items: [digital], payment_collections: unpaid }))).toBe(
      "awaiting_payment"
    )
    expect(lifecycleOf(order({ items: [digital, line(1)] }))).toBe("to_ship")
    expect(lifecycleOf(order({ items: [digital, line(1, 1, 1, 1)] }))).toBe("delivered")
  })
})

describe("lifecycleOf with dated lines (adr/0076 §8)", () => {
  const now = new Date("2027-03-01T10:00:00Z")
  const dated = (startsAt: string) => ({
    ...line(2),
    requires_shipping: false,
    metadata: { qt_booking: { hold_id: "h", slot_id: "s", starts_at: startsAt, pax: 1 } },
  })
  const future = dated("2027-04-01T07:00:00+03:00")
  const past = dated("2027-02-01T07:00:00+03:00")

  it("is planned until the service date once paid, then completed", () => {
    expect(lifecycleOf(order({ items: [future] }), now)).toBe("planned")
    expect(lifecycleOf(order({ items: [past] }), now)).toBe("delivered")
    // The latest date of several departures decides
    expect(lifecycleOf(order({ items: [past, future] }), now)).toBe("planned")
  })

  it("waits for payment as before, and a parcel to send comes first", () => {
    const unpaid = [{ status: "not_paid", amount: 10, captured_amount: 0 }]

    expect(lifecycleOf(order({ items: [future], payment_collections: unpaid }), now)).toBe(
      "awaiting_payment"
    )
    expect(lifecycleOf(order({ items: [future, line(1)] }), now)).toBe("to_ship")
    expect(lifecycleOf(order({ items: [future, line(1, 1, 1, 1)] }), now)).toBe("planned")
  })

  it("reads a dated-only order whose money all went back as canceled", () => {
    const refunded = [
      { status: "refunded", amount: 100, captured_amount: 100, refunded_amount: 100 },
    ]

    expect(lifecycleOf(order({ items: [future], payment_collections: refunded }), now)).toBe(
      "canceled"
    )
  })

  it("leaves other lines without shipping as they were, and ignores an index for now", () => {
    const digital = { ...line(1), requires_shipping: false }

    expect(lifecycleOf(order({ items: [digital] }), now)).toBe("delivered")
    expect([order({ items: [digital] })].map(lifecycleOf)).toEqual(["delivered"])
  })
})
