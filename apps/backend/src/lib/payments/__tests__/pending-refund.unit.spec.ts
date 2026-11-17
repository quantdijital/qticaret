import { kurus } from "../../money"
import { recordedRefund, refundRecorded, withRefundRecord } from "../pending-refund"

describe("a refund recorded in the payment's data, as our ledger reads it (review 2026-11-17)", () => {
  it("finds our order refund's reference as sent, or as PayTR takes it", () => {
    const data = { refunds: [{ reference_no: "refund0000000001", amount: 1000 }] }

    expect(refundRecorded(data, "refund0000000001", 1000)).toBe(true)
    // PayTR takes letters and digits only: the panel's key arrives stripped
    expect(refundRecorded(data, "refund-0000-0000-01", 1000)).toBe(true)
    expect(refundRecorded(data, "refund0000000002", 1000)).toBe(false)
    // Another amount under the reference is not this refund (review D5)
    expect(refundRecorded(data, "refund0000000001", 500)).toBe(false)
    expect(refundRecorded({}, "refund0000000001", 1000)).toBe(false)
    expect(refundRecorded(null, "refund0000000001", 1000)).toBe(false)
  })

  it("records a refund once under its reference, keeping the rest of the data", () => {
    const once = withRefundRecord({ payment_id: "1" }, "qtref01A", kurus(1000))
    const twice = withRefundRecord(once, "qtref01A", kurus(1000))

    expect(twice).toEqual({
      payment_id: "1",
      refunds: [{ reference_no: "qtref01A", amount: 1000 }],
    })
  })

  it("records a refund the shop makes by hand under our order refund's name only", () => {
    const named = { pending_refund: { reference_no: "qtref01A", amount: 1000 } }

    expect(recordedRefund({ amount: 10, data: named })).toEqual({
      ...named,
      refunds: [{ reference_no: "qtref01A", amount: 1000 }],
    })
    // Another amount, or Medusa's own refund: the data as it was
    expect(recordedRefund({ amount: 5, data: named })).toEqual(named)
    expect(recordedRefund({ amount: 10, data: {} })).toEqual({})
  })
})
