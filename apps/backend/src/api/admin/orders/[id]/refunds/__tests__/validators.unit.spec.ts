import { checkedNote } from "../../../../../../workflows/orders/made-refund-record"
import { AdminPostOrderRefund, AdminPostOrderRefundSettle } from "../validators"

const REFERENCE = "0123456789abcdef0123456789abcdef"

describe("the order refund request (F5 V5; security review D4, sixth round D-1)", () => {
  it("takes the panel's key and a note of the shop's own", () => {
    expect(
      AdminPostOrderRefund.safeParse({ amount: 30, reference: REFERENCE, note: "kırık kupa" })
        .success
    ).toBe(true)
  })

  it("refuses a key not the panel's form, and a note a staff check writes", () => {
    expect(AdminPostOrderRefund.safeParse({ amount: 30, reference: "M1N1" }).success).toBe(false)
    for (const note of [checkedNote(REFERENCE), "  REFUND CHECKED AT THE PROVIDER: x"]) {
      const parsed = AdminPostOrderRefund.safeParse({ amount: 30, reference: REFERENCE, note })
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues[0]?.message).toBe("orders.refund_note_reserved")
    }
  })
})

describe("an open refund settled by hand (review O2; D4-1)", () => {
  it("takes the three outcomes, made in part among them", () => {
    for (const outcome of ["made", "not_made", "made_in_part"]) {
      expect(AdminPostOrderRefundSettle.safeParse({ outcome }).success).toBe(true)
    }
  })

  it("never takes an amount: the made part is read from the ledger", () => {
    expect(
      AdminPostOrderRefundSettle.safeParse({ outcome: "made_in_part", amount: 240 }).success
    ).toBe(false)
    expect(AdminPostOrderRefundSettle.safeParse({ outcome: "made_some" }).success).toBe(false)
  })
})
