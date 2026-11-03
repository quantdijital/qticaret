import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import type { ReturnRequestRow, StoreOrder } from "@/lib/orders/order"
import { orderView } from "../order"
import { requestWordsOf, returnNoteOf, returnableOf } from "../order-returns"

/*
 * adr/0025 (2026-11-03): a gift card line is withdrawn from once its cards
 * went out, whatever the parcels, on its own and as money back.
 */

const GIFT = "ordli_01K0000000000000000000GIFT"
const KNIFE = "ordli_01K000000000000000000KNIFE"

type Line = StoreOrder["items"][number]

const giftLine = (cards: string[]): Line => ({
  id: GIFT,
  title: "Hediye kartı",
  subtitle: null,
  variant_title: "500 TL",
  thumbnail: null,
  quantity: 2,
  total: 1000,
  metadata: {
    qt_gift: { recipient_email: "zeynep@example.com" },
    ...(cards.length ? { qt_gift_cards: cards.map((last4, i) => ({ id: `gc_${i}`, last4 })) } : {}),
  },
})

const knifeLine: Line = {
  id: KNIFE,
  title: "Çakı",
  subtitle: null,
  variant_title: "Siyah",
  thumbnail: null,
  quantity: 1,
  total: 1335,
  metadata: null,
}

const order = (items: Line[], fulfillment = "not_fulfilled", status = "pending"): StoreOrder => ({
  id: "order_01K0000000000000000000ORDER",
  display_id: 1002,
  email: "ayse@example.com",
  created_at: "2026-11-03T10:00:00.000Z",
  status,
  payment_status: "captured",
  fulfillment_status: fulfillment,
  items,
  original_item_total: 2335,
  item_total: 2335,
  shipping_total: 0,
  total: 2335,
  shipping_address: null,
})

const request = (
  status: string,
  items: { line_item_id: string; quantity: number }[] | null,
  code: string | null = null
): ReturnRequestRow => ({
  kind: "return",
  status,
  return_code: code,
  created_at: "2026-11-03T12:00:00.000Z",
  items,
})

const view = (o: StoreOrder, returns: ReturnRequestRow[] = []) =>
  orderView(o, null, false, t, {
    token: null,
    contracts: [],
    returns,
    shipments: [],
    invoice: null,
    note: null,
  })

describe("a gift card line on the return form", () => {
  it("is offered on an unshipped order once its cards went out, worded and with the right of withdrawal only", () => {
    const page = view(order([giftLine(["AB12", "CD34"])]))
    expect(page.returnable).toEqual([
      {
        id: GIFT,
        title: "Hediye kartı",
        quantity: 2,
        excluded: null,
        gift: true,
        note: "Kartlar iptal edilir ve ödediğiniz tutar iade edilir; bir şey göndermeniz gerekmez.",
      },
    ])
    expect(page.giftReasons).toEqual([{ value: "changed_mind", label: "Cayma hakkı (vazgeçtim)" }])
    // Cards sent are withdrawn from, not cancelled with the order
    expect(page.cancellable).toBe(false)
  })

  it("is not offered before its cards went out, when the order may still be cancelled", () => {
    const page = view(order([giftLine([])]))
    expect(page.returnable).toBeNull()
    expect(page.cancellable).toBe(true)
    expect(view(order([giftLine(["AB12"])], "not_fulfilled", "canceled")).returnable).toBeNull()
  })

  it("offers the cards not asked back yet; a refused or cancelled request gives them back", () => {
    const returns = [
      request("refunded", [{ line_item_id: GIFT, quantity: 1 }]),
      request("rejected", [{ line_item_id: GIFT, quantity: 1 }]),
      request("canceled", [{ line_item_id: GIFT, quantity: 1 }]),
    ]
    expect(view(order([giftLine(["AB12", "CD34"])]), returns).returnable?.[0]?.quantity).toBe(1)
    const all = [...returns, request("received", [{ line_item_id: GIFT, quantity: 1 }])]
    expect(view(order([giftLine(["AB12", "CD34"])]), all).returnable).toBeNull()
  })

  it("keeps the physical lines to a shipped order, each kind flagged", () => {
    const unshipped = view(order([knifeLine, giftLine(["AB12"])]))
    expect(unshipped.returnable?.map((line) => [line.id, line.gift])).toEqual([[GIFT, true]])
    const shipped = view(order([knifeLine, giftLine(["AB12"])], "delivered"))
    expect(shipped.returnable?.map((line) => [line.id, line.gift, line.note])).toEqual([
      [KNIFE, false, null],
      [GIFT, true, expect.stringContaining("Kartlar iptal edilir")],
    ])
  })
})

describe("why a line is outside the right of withdrawal", () => {
  it("words each backend reason; a spent card's line stays, with nothing to choose", () => {
    const sameAsBefore = "Bu satır için cayma hakkı yok; yalnızca ayıplı/yanlış ürün iadesi."
    expect(returnNoteOf("product", false, t)).toBe(sameAsBefore)
    expect(returnNoteOf("personal_addon", false, t)).toBe(sameAsBefore)
    expect(returnNoteOf("gift_card_used", true, t)).toBe("Kart kullanıldığı için cayma hakkı yok.")
    expect(returnNoteOf(null, false, t)).toBeNull()

    const reasons = new Map([[GIFT, "gift_card_used" as const]])
    expect(returnableOf(order([giftLine(["AB12"])]), [], t, reasons)).toEqual([
      expect.objectContaining({ id: GIFT, quantity: 0, excluded: "gift_card_used", gift: true }),
    ])
    // A plain line inside the right; one made to the buyer's wish: addons.spec.ts
    expect(returnableOf(order([knifeLine], "delivered"), [], t)?.[0]?.excluded).toBeNull()
  })
})

describe("a request in words", () => {
  const gifts = new Set([GIFT])

  it("says a gift card withdrawal voids the cards and refunds, with no parcel code", () => {
    const words = (status: string) =>
      requestWordsOf(request(status, [{ line_item_id: GIFT, quantity: 1 }], "RC1"), gifts, t)
    expect(words("requested")).toEqual({
      kind: "Hediye kartı cayması",
      status: "İnceleniyor",
      code: null,
    })
    expect(words("received").status).toBe("Kartlar iptal edildi, iade yapılıyor")
    expect(words("refunded").status).toBe("Kartlar iptal edildi, iade yapıldı")
    expect(words("rejected").status).toBe("Reddedildi")
  })

  it("words any other request as before, its refund included", () => {
    expect(
      requestWordsOf(request("refunded", [{ line_item_id: KNIFE, quantity: 1 }], "RC1"), gifts, t)
    ).toEqual({ kind: "İade", status: "Ücret iade edildi", code: "RC1" })
    expect(requestWordsOf(request("requested", null), gifts, t).kind).toBe("İade")
  })

  it("lists the order's requests with their words on the page", () => {
    const page = view(order([giftLine(["AB12"])]), [
      request("refunded", [{ line_item_id: GIFT, quantity: 1 }]),
    ])
    expect(page.returns).toHaveLength(1)
    expect(page.returns[0]).toMatchObject({
      kind: "Hediye kartı cayması",
      status: "Kartlar iptal edildi, iade yapıldı",
      code: null,
      date: "3 Kasım 2026 15:00",
    })
  })
})
