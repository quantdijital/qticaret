import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import type { ReturnableRow, StoreOrder } from "@/lib/orders/order"
import { orderView } from "../order"
import { GIFT, KNIFE, found, giftLine, knifeLine, order, row } from "@/test/order-fixtures"

/*
 * docs/19 §7 "Sipariş": each line by its own window (a shipped line's from
 * its parcels, a gift line's from its cards), no form while a request is
 * open, an exchange's variants, and the cancel by the backend's own rule.
 */

const view = (o: StoreOrder, returnable: ReturnableRow | null) =>
  orderView(o, null, false, t, {
    token: null,
    contracts: [],
    returns: [],
    returnable,
    shipments: [],
    invoice: null,
    note: null,
  })

const mixed = order([knifeLine, giftLine(["AB12"])], "shipped")

describe("the return form by each line's window", () => {
  it("leaves out a shipped line whose window closed while the gift line's is open", () => {
    const page = view(
      mixed,
      found([
        { ...row(KNIFE, 1), window_open: false, window_closed_reason: "expired" },
        { ...row(GIFT, 1, { gift_card: true }), window_open: true, window_closed_reason: null },
      ])
    )
    expect(page.returnable?.map((line) => line.id)).toEqual([GIFT])
  })

  it("offers no form while a request is open: the shop decides it first", () => {
    expect(view(mixed, found([row(KNIFE, 1)], { open_request: true })).returnable).toBeNull()
  })

  it("reads the order's window alone from a backend that does not say each line's", () => {
    expect(view(mixed, found([row(KNIFE, 1)])).returnable?.map((line) => line.id)).toEqual([KNIFE])
  })

  it("offers an exchange's variants by name, never for a gift line or one outside the right", () => {
    const variants = [
      { id: "variant_buyuk", title: "Büyük" },
      { id: "variant_bos", title: null },
    ]
    const page = view(
      mixed,
      found([
        { ...row(KNIFE, 1), variants },
        { ...row(GIFT, 1, { gift_card: true }), variants },
      ])
    )
    expect(page.returnable?.find((line) => line.id === KNIFE)?.variants).toEqual([
      { value: "variant_buyuk", label: "Büyük" },
    ])
    expect(page.returnable?.find((line) => line.id === GIFT)?.variants).toEqual([])
    const personal = view(
      mixed,
      found([{ ...row(KNIFE, 1, { reason: "personal_addon" }), variants }])
    )
    expect(personal.returnable?.[0]?.variants).toEqual([])
  })
})

describe("the cancel by the backend's rule", () => {
  const unshipped = order([knifeLine])

  it("follows the backend over the page's own guess", () => {
    const refused = found([row(KNIFE, 0)], {
      window_open: false,
      cancellable: false,
      cancel_refusal: "orders.cancel_after_packing",
    })
    expect(view(unshipped, refused)).toMatchObject({ cancellable: false, cancelNote: null })
    const allowed = found([row(KNIFE, 0)], { window_open: false, cancellable: true })
    expect(view(unshipped, allowed)).toMatchObject({ cancellable: true, cancelNote: null })
  })

  it("says why where the shopper can act on it: money taken by hand, a gift card used", () => {
    const byHand = found([row(KNIFE, 0)], {
      cancellable: false,
      cancel_refusal: "orders.cancel_contact_shop",
    })
    expect(view(unshipped, byHand).cancelNote).toBe(t("orders.cancel_contact_shop"))
    const used = found([row(GIFT, 0, { gift_card: true })], {
      cancellable: false,
      cancel_refusal: "orders.gift_card_used",
    })
    expect(view(order([giftLine(["AB12"])]), used).cancelNote).toBe(t("orders.gift_card_used"))
  })
})
