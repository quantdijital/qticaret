import { COD_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"
import { cancelRefusal } from "../customer-cancel"
import type { CancelOrderRow } from "../customer-cancel"

/*
 * The shopper's cancel (F7.13) and the order page's `cancellable` read one
 * rule: before packing, and only while the money can go back by itself.
 */

const paid = (
  ...payments: { provider_id: string; captured_at: string | null }[]
): CancelOrderRow => ({
  customer_id: "cus_1",
  status: "pending",
  fulfillments: [],
  payment_collections: [{ payments }],
})

const card = { provider_id: "pp_paytr_paytr", captured_at: "2026-11-04T10:00:00Z" }

describe("whether the shopper may cancel an order", () => {
  it("may before packing: a card paid or a transfer not confirmed yet", () => {
    expect(cancelRefusal(paid(card))).toBeNull()
    expect(
      cancelRefusal(paid({ provider_id: "pp_bank-transfer_bank-transfer", captured_at: null }))
    ).toBeNull()
    expect(
      cancelRefusal(paid({ provider_id: COD_PAYMENT_PROVIDER_ID, captured_at: null }))
    ).toBeNull()
  })

  it("is done already once cancelled; a packed parcel or a completed order comes back as a return", () => {
    expect(cancelRefusal({ ...paid(card), status: "canceled" })).toBe("orders.canceled")
    expect(cancelRefusal({ ...paid(card), fulfillments: [{ canceled_at: null }] })).toBe(
      "orders.cancel_after_packing"
    )
    // A parcel cancelled before it left is none
    expect(
      cancelRefusal({ ...paid(card), fulfillments: [{ canceled_at: "2026-11-04T11:00:00Z" }] })
    ).toBeNull()
    expect(cancelRefusal({ ...paid(card), status: "completed" })).toBe(
      "orders.cancel_after_packing"
    )
  })

  it("goes through the shop when the money was taken by hand", () => {
    expect(
      cancelRefusal(
        paid({ provider_id: "pp_bank-transfer_bank-transfer", captured_at: "2026-11-04T09:00:00Z" })
      )
    ).toBe("orders.cancel_contact_shop")
    // A difference staff collected on an edit is a second payment
    expect(cancelRefusal(paid(card, { ...card, captured_at: "2026-11-04T12:00:00Z" }))).toBe(
      "orders.cancel_contact_shop"
    )
  })

  it("sends a paid dated order to its departures' own cancel (adr/0076 Ek D7a)", () => {
    const dated = {
      metadata: {
        qt_booking: { hold_id: "h", slot_id: "s", starts_at: "2027-01-01T07:00:00Z", pax: 1 },
      },
    }
    const unpaid = { provider_id: "pp_bank-transfer_bank-transfer", captured_at: null }

    expect(cancelRefusal({ ...paid(card), items: [dated, { metadata: null }] })).toBe(
      "booking.use_booking_cancel"
    )
    // Nothing taken yet: the whole order may still be cancelled, its places given back
    expect(cancelRefusal({ ...paid(unpaid), items: [dated] })).toBeNull()
    expect(cancelRefusal({ ...paid(card), items: [{ metadata: null }] })).toBeNull()

    // adr/0076 Ek basit yol: the shop takes cancels by phone, paid or not
    expect(cancelRefusal({ ...paid(unpaid), items: [dated] }, false)).toBe(
      "booking.cancel_by_contact"
    )
    expect(cancelRefusal({ ...paid(card), items: [dated] }, false)).toBe(
      "booking.cancel_by_contact"
    )
    // An order without a dated line is not touched by it; a cancelled one stays done
    expect(cancelRefusal({ ...paid(card), items: [{ metadata: null }] }, false)).toBeNull()
    expect(cancelRefusal({ ...paid(unpaid), items: [dated], status: "canceled" }, false)).toBe(
      "orders.canceled"
    )
  })
})
