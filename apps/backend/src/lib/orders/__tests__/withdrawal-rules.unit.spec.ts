import {
  productMarkOf,
  refundDeadlineNear,
  refundDueAt,
  refusalProblem,
  shippingRefundDue,
} from "../withdrawal-rules"

const DAY = 24 * 60 * 60 * 1000
const line = (line_item_id: string, quantity = 1) => ({ line_item_id, quantity })

describe("productMarkOf (MSY md. 15/1, adr/0052 Ek 2026-11-03)", () => {
  it("keeps a physical product inside the right, warned as a sealed good (15/1-ç)", () => {
    expect(productMarkOf(true, "physical")).toEqual({ excluded: false, warning: "sealed_goods" })
    // No kind recorded reads as physical (F3.2)
    expect(productMarkOf(true, null)).toEqual({ excluded: false, warning: "sealed_goods" })
  })

  it("puts a digital or service product out outright (15/1-ğ, h)", () => {
    expect(productMarkOf(true, "digital")).toEqual({ excluded: true, warning: null })
    expect(productMarkOf(true, "service")).toEqual({ excluded: true, warning: null })
  })

  it("means nothing unmarked", () => {
    expect(productMarkOf(false, "digital")).toEqual({ excluded: false, warning: null })
    expect(productMarkOf(undefined, "physical")).toEqual({ excluded: false, warning: null })
  })
})

describe("shippingRefundDue (MSY md. 12/1, adr/0032 Ek 2026-11-03)", () => {
  const base = {
    kind: "return" as const,
    accepted: [line("a")],
    excluded: new Set<string>(),
    staff_choice: false,
    refunded_before: false,
  }

  it("gives a withdrawal's shipping back whatever staff tick, a part of the order too", () => {
    expect(shippingRefundDue(base)).toBe(true)
    // One line inside the right among excluded ones is still a withdrawal
    expect(
      shippingRefundDue({ ...base, accepted: [line("a"), line("b")], excluded: new Set(["b"]) })
    ).toBe(true)
  })

  it("leaves a faulty excluded line's shipping to staff (TKHK md. 11)", () => {
    const excluded = new Set(["a"])
    expect(shippingRefundDue({ ...base, excluded })).toBe(false)
    expect(shippingRefundDue({ ...base, excluded, staff_choice: true })).toBe(true)
  })

  it("never on a swap, with nothing accepted, or once given back already", () => {
    expect(shippingRefundDue({ ...base, kind: "exchange", staff_choice: true })).toBe(false)
    expect(shippingRefundDue({ ...base, accepted: [], staff_choice: true })).toBe(false)
    expect(shippingRefundDue({ ...base, accepted: [line("a", 0)] })).toBe(false)
    expect(shippingRefundDue({ ...base, refunded_before: true })).toBe(false)
  })
})

describe("refusalProblem (MSY md. 15/1-ç)", () => {
  it("refuses only a sealed good's units", () => {
    const sealed = new Set(["a"])
    expect(refusalProblem([], sealed)).toBeNull()
    expect(refusalProblem([line("a")], sealed)).toBeNull()
    expect(refusalProblem([line("a"), line("b")], sealed)).toBe("returns.refusal_not_sealed")
  })
})

describe("refund deadline (MSY md. 12/1)", () => {
  const handover = new Date("2026-11-01T09:00:00.000Z")

  it("runs 14 days from the handover to the return carrier, else from arrival", () => {
    expect(refundDueAt({ handed_over_at: handover })?.getTime()).toBe(handover.getTime() + 14 * DAY)
    expect(
      refundDueAt({
        handed_over_at: handover.toISOString(),
        received_at: new Date(handover.getTime() + 3 * DAY),
      })?.getTime()
    ).toBe(handover.getTime() + 14 * DAY)
    expect(refundDueAt({ handed_over_at: null, received_at: handover })?.getTime()).toBe(
      handover.getTime() + 14 * DAY
    )
    expect(refundDueAt({})).toBeNull()
    expect(refundDueAt({ handed_over_at: "not a date" })).toBeNull()
  })

  it("tells staff from the 10th day on, never before", () => {
    const request = { handed_over_at: handover }
    expect(refundDeadlineNear(request, new Date(handover.getTime() + 10 * DAY - 1))).toBe(false)
    expect(refundDeadlineNear(request, new Date(handover.getTime() + 10 * DAY))).toBe(true)
    expect(refundDeadlineNear(request, new Date(handover.getTime() + 20 * DAY))).toBe(true)
    expect(refundDeadlineNear({}, new Date(handover.getTime() + 20 * DAY))).toBe(false)
  })
})
