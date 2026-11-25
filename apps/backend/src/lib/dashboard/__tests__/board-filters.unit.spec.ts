import { oneOf, paymentFilterOf, shippingFilterOf } from "../board-filters"
import type { LifecycleOrder } from "../lifecycle"

const order = (collection: Record<string, unknown> | null): LifecycleOrder => ({
  status: "pending",
  currency_code: "try",
  payment_collections: collection ? [collection] : [],
})

describe("order list filters", () => {
  it("puts the order's money in one of three: taken, given back, not yet", () => {
    expect(paymentFilterOf(order({ status: "completed", amount: 100, captured_amount: 100 }))).toBe(
      "paid"
    )
    expect(paymentFilterOf(order({ status: "authorized", amount: 100 }))).toBe("paid")
    expect(
      paymentFilterOf(
        order({ status: "completed", amount: 100, captured_amount: 100, refunded_amount: 100 })
      )
    ).toBe("refunded")
    expect(paymentFilterOf(order({ status: "not_paid", amount: 100 }))).toBe("awaiting")
    expect(paymentFilterOf(order(null))).toBe("awaiting")
  })

  it("reads the parcel by its carrier's word, else by the order's own state", () => {
    expect(shippingFilterOf("shipped", "created")).toBe("label")
    expect(shippingFilterOf("shipped", "in_transit")).toBe("on_the_way")
    expect(shippingFilterOf("shipped", "failed")).toBe("problem")
    expect(shippingFilterOf("delivered", "delivered")).toBe("delivered")
    // The shop's own delivery: no carrier's word
    expect(shippingFilterOf("shipped", null)).toBe("on_the_way")
    expect(shippingFilterOf("delivered", null)).toBe("delivered")
    expect(shippingFilterOf("to_ship", "canceled")).toBe("none")
  })
})

describe("a value among a filter's choices", () => {
  it("keeps any of the choices, and everything when none is set", () => {
    expect(oneOf(["paid", "refunded"], "refunded")).toBe(true)
    expect(oneOf(["paid", "refunded"], "awaiting")).toBe(false)
    expect(oneOf(["paid"], "paid")).toBe(true)
    expect(oneOf(undefined, "awaiting")).toBe(true)
    expect(oneOf([], "awaiting")).toBe(true)
  })
})
