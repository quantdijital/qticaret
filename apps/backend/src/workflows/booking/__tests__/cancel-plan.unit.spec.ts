import { kurus } from "../../../lib/money"
import { cancelsOrder, sendsRefund } from "../cancel"
import { customerCancelRefusal, manualRefundOf } from "../cancel-plan"

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-12-01T09:00:00Z")

const plan = (overrides: Partial<Parameters<typeof customerCancelRefusal>[0]> = {}) => ({
  order_status: "pending",
  starts_at: new Date(NOW.getTime() + 10 * DAY),
  rule: { fee_percent: 20, days_before: 7 },
  unpaid: false,
  taken_by_hand: false,
  manual: null,
  ...overrides,
})

describe("a departure's refund left to staff (review O1, O2)", () => {
  const base = { refund: kurus(90000), taken_by_hand: false, credit: kurus(0), exceeds: false }

  it("sends a card's refund on its own", () => {
    expect(manualRefundOf(base)).toBeNull()
  })

  it("leaves money taken by hand to staff before anything else", () => {
    expect(manualRefundOf({ ...base, taken_by_hand: true, credit: kurus(100) })).toBe("offline")
  })

  it("never turns gift card or store credit into cash", () => {
    expect(manualRefundOf({ ...base, credit: kurus(40000) })).toBe("credit")
  })

  it("leaves a share above what the payments hold to staff", () => {
    expect(manualRefundOf({ ...base, exceeds: true })).toBe("exceeds")
  })

  it("has nothing to leave when nothing is due", () => {
    expect(manualRefundOf({ ...base, refund: kurus(0), taken_by_hand: true })).toBeNull()
  })

  it("sends only a refund due and not left to staff", () => {
    const request = { items: [{ id: "item_1", quantity: 1 }], fee_percent: 0 }
    expect(sendsRefund({ request, refund: kurus(100), manual: null })).toBe(true)
    expect(sendsRefund({ request, refund: kurus(100), manual: "offline" })).toBe(false)
    expect(sendsRefund({ request, refund: kurus(100), manual: "credit" })).toBe(false)
    expect(sendsRefund({ request: null, refund: kurus(0), manual: null })).toBe(false)
  })
})

describe("the shopper's own cancel", () => {
  it("is open for a card payment before the day, under a tier", () => {
    expect(customerCancelRefusal(plan(), NOW)).toBeNull()
  })

  it("sends the shopper to the shop when the refund is staff's to give", () => {
    expect(customerCancelRefusal(plan({ manual: "credit" }), NOW)).toBe(
      "orders.cancel_contact_shop"
    )
    expect(customerCancelRefusal(plan({ manual: "exceeds" }), NOW)).toBe(
      "orders.cancel_contact_shop"
    )
    expect(customerCancelRefusal(plan({ taken_by_hand: true }), NOW)).toBe(
      "orders.cancel_contact_shop"
    )
  })

  it("refuses in order: cancelled, too late, no tier, unpaid", () => {
    expect(customerCancelRefusal(plan({ order_status: "canceled" }), NOW)).toBe("orders.canceled")
    expect(customerCancelRefusal(plan({ starts_at: NOW }), NOW)).toBe("booking.cancel_too_late")
    expect(customerCancelRefusal(plan({ rule: null }), NOW)).toBe("booking.cancel_unavailable")
    expect(customerCancelRefusal(plan({ unpaid: true, manual: "credit" }), NOW)).toBe(
      "booking.cancel_unpaid"
    )
  })
})

describe("an unpaid order cancelled with its last departure (review O3)", () => {
  const unpaid = { unpaid: true, dated_only: true, order_status: "pending" }

  it("goes once nothing was paid, every line is dated and no departure is left", () => {
    expect(cancelsOrder(unpaid, 0)).toBe(true)
  })

  it("stays while a departure is left, money was taken, a line ships or it is cancelled", () => {
    expect(cancelsOrder(unpaid, 1)).toBe(false)
    expect(cancelsOrder({ ...unpaid, unpaid: false }, 0)).toBe(false)
    expect(cancelsOrder({ ...unpaid, dated_only: false }, 0)).toBe(false)
    expect(cancelsOrder({ ...unpaid, order_status: "canceled" }, 0)).toBe(false)
  })
})
