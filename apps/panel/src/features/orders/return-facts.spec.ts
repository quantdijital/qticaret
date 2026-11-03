import { describe, expect, it } from "vitest"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { allRefused, refundDeadline, sealedLinesOf } from "./return-facts"
import { initialCounts, linesOf, setCount, shippingRule } from "./receive-rules"

const DAY = 24 * 60 * 60 * 1000
const now = new Date("2026-11-03T12:00:00.000Z")
const at = (days: number) => new Date(now.getTime() + days * DAY).toISOString()

type Facts = Parameters<typeof refundDeadline>[0]

const facts = (more: Partial<Facts>): Facts => ({
  kind: "return",
  status: "approved",
  refund_due_at: at(10),
  received_items: null,
  damaged_items: null,
  refused_items: null,
  ...more,
})

const line = (line_item_id: string, quantity = 1) => ({ line_item_id, quantity })

describe("refundDeadline (MSY md. 12/1, adr/0032 Ek 2026-11-03)", () => {
  it("shows the last day plain, red in its last 4 days and once past", () => {
    expect(refundDeadline(facts({ refund_due_at: at(10) }), now)).toEqual({
      due_at: at(10),
      state: "open",
      days_left: 10,
    })
    // The server's bell rings on the 10th day: from then on, red
    expect(refundDeadline(facts({ refund_due_at: at(4) }), now)?.state).toBe("near")
    expect(refundDeadline(facts({ refund_due_at: at(4.01) }), now)?.state).toBe("open")
    expect(refundDeadline(facts({ refund_due_at: at(0.2) }), now)).toMatchObject({
      state: "near",
      days_left: 1,
    })
    expect(refundDeadline(facts({ refund_due_at: at(-1) }), now)).toMatchObject({
      state: "late",
      days_left: 0,
    })
  })

  it("says nothing once nothing is owed, before the clock starts, or on a swap", () => {
    expect(refundDeadline(facts({ status: "refunded" }), now)).toBeNull()
    expect(refundDeadline(facts({ status: "rejected" }), now)).toBeNull()
    expect(refundDeadline(facts({ kind: "exchange" }), now)).toBeNull()
    expect(refundDeadline(facts({ refund_due_at: null }), now)).toBeNull()
    expect(refundDeadline(facts({ refund_due_at: "not a date" }), now)).toBeNull()
    // Received with everything refused: no money due
    const refused = { refused_items: [{ ...line("a"), reason: "unsealed" as const }] }
    expect(refundDeadline(facts({ status: "received", ...refused }), now)).toBeNull()
    expect(
      refundDeadline(facts({ status: "received", received_items: [line("b")], ...refused }), now)
        ?.state
    ).toBe("open")
  })
})

describe("what a receipt refused", () => {
  const request = {
    status: "received" as const,
    received_items: [] as { line_item_id: string; quantity: number }[],
    damaged_items: null,
    refused_items: [
      { ...line("a", 2), reason: "unsealed" as const },
      { ...line("b"), reason: "unsealed" as const },
    ],
  }

  it("is all of it only when nothing came back sound or damaged", () => {
    expect(allRefused(request)).toBe(true)
    expect(allRefused({ ...request, damaged_items: [line("c")] })).toBe(false)
    expect(allRefused({ ...request, refused_items: null })).toBe(false)
    expect(allRefused({ ...request, status: "approved" })).toBe(false)
  })
})

const requestOf = (items: ReturnRequest["items"], kind: ReturnRequest["kind"] = "return") => ({
  kind,
  items,
})

const item = (line_item_id: string, more: Partial<ReturnRequest["items"][number]> = {}) => ({
  line_item_id,
  quantity: 2,
  withdrawal_excluded: false,
  withdrawal_excluded_reason: null,
  withdrawal_warning: null,
  ...more,
})

describe("receive rules (adr/0032 Ek 2026-11-03)", () => {
  it("finds the sealed goods a receipt may refuse", () => {
    const request = requestOf([item("a", { withdrawal_warning: "sealed_goods" }), item("b")])
    expect([...sealedLinesOf(request)]).toEqual(["a"])
  })

  it("keeps sound, damaged and refused within what was asked, sound giving way first", () => {
    const all = { sound: 3, damaged: 0, refused: 0 }
    expect(setCount(all, "refused", 1, 3)).toEqual({ sound: 2, damaged: 0, refused: 1 })
    expect(setCount({ sound: 0, damaged: 2, refused: 1 }, "sound", 3, 3)).toEqual({
      sound: 3,
      damaged: 0,
      refused: 0,
    })
    expect(setCount({ sound: 1, damaged: 1, refused: 1 }, "damaged", 9, 3)).toEqual({
      sound: 0,
      damaged: 3,
      refused: 0,
    })
    expect(setCount(all, "refused", -2, 3)).toEqual(all)
  })

  it("gives the shipping by law with a line inside the right, else to staff, else none", () => {
    const request = requestOf([
      item("in"),
      item("out", { withdrawal_excluded: true, withdrawal_excluded_reason: "personal_addon" }),
    ])
    const counts = initialCounts(request)
    expect(shippingRule(request, counts)).toBe("law")
    const outOnly = { ...counts, in: { sound: 0, damaged: 0, refused: 0 } }
    expect(shippingRule(request, outOnly)).toBe("choice")
    expect(shippingRule(request, { ...outOnly, out: { sound: 0, damaged: 1, refused: 0 } })).toBe(
      "choice"
    )
    expect(shippingRule(request, { ...outOnly, out: { sound: 0, damaged: 0, refused: 2 } })).toBe(
      "none"
    )
    expect(shippingRule({ ...request, kind: "exchange" }, counts)).toBe("none")
    expect(linesOf(outOnly, "sound")).toEqual([line("out", 2)])
  })
})
