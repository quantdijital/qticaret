import { placedAlertOf } from "../placed-alert"

describe("placedAlertOf: one alert per placed order", () => {
  it.each([
    // wholesale, bank transfer, payment link → the alert
    [false, false, false, "new_order"],
    [false, true, false, "bank_transfer_pending"],
    [true, false, false, "wholesale_order"],
    // A wholesaler's transfer: the wholesale alert says the money is awaited
    [true, true, false, "wholesale_order"],
    // The link rings its own "paid"; a transfer through it is still awaited
    [false, false, true, null],
    [true, false, true, null],
    [false, true, true, "bank_transfer_pending"],
  ] as const)(
    "wholesale %s, transfer %s, link %s → %s",
    (wholesale, bankTransfer, paymentLink, expected) => {
      expect(placedAlertOf({ wholesale, bankTransfer, paymentLink })).toBe(expected)
    }
  )
})
