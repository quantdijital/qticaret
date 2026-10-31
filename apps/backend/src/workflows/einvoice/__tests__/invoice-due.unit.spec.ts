import { COD_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import { invoiceDue } from "../queue-invoices"
import type { InvoiceMoment, OrderRow } from "../queue-invoices"

const paidBy = (provider_id: string, captured_at: string | null): OrderRow => ({
  payment_collections: [{ payments: [{ provider_id, captured_at }] }],
})

const card = paidBy("pp_paytr_paytr", "2026-10-31T08:00:00Z")
const transferWaiting = paidBy("pp_bank-transfer_bank-transfer", null)
const cashAtTheDoor = paidBy(COD_PAYMENT_PROVIDER_ID, null)
const cashCollected = paidBy(COD_PAYMENT_PROVIDER_ID, "2026-11-02T10:00:00Z")

const MOMENTS: InvoiceMoment[] = ["placed", "paid", "shipped", "delivered"]
const dueAt = (order: OrderRow, trigger: "placed" | "shipped") =>
  MOMENTS.filter((moment) => invoiceDue(order, moment, { trigger }))

describe("when an order's invoice is due (adr/0034 §8, the accountant 2026-10-31)", () => {
  it("is due once placed and paid by default, a transfer once confirmed", () => {
    expect(dueAt(card, "placed")).toEqual(["placed", "paid"])
    expect(dueAt(transferWaiting, "placed")).toEqual([])
  })

  it("is due when the parcel leaves on that setting, a delivery counting too", () => {
    expect(dueAt(card, "shipped")).toEqual(["shipped", "delivered"])
    expect(dueAt(transferWaiting, "shipped")).toEqual(["shipped", "delivered"])
  })

  it("is due for cash on delivery once delivered or collected, whatever the setting", () => {
    for (const trigger of ["placed", "shipped"] as const) {
      expect(dueAt(cashAtTheDoor, trigger)).toEqual(["delivered"])
      expect(dueAt(cashCollected, trigger)).toEqual(["paid", "delivered"])
    }
  })
})
