import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import type { ReturnRequestRow, ReturnableRow, StoreOrder } from "@/lib/orders/order"
import { orderView } from "../order"
import { requestWordsOf, returnNoteOf, returnableOf } from "../order-returns"
import { GIFT, KNIFE, found, giftLine, knifeLine, order, row } from "@/test/order-fixtures"

/*
 * adr/0025 (2026-11-03): a gift card line is withdrawn from once its cards
 * went out, whatever the parcels, on its own and as money back. What may
 * come back, how many and why a line is out are the backend's
 * (`GET /store/orders/:id/returnable`); the page only words them.
 */

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

const view = (
  o: StoreOrder,
  returnable: ReturnableRow | null,
  returns: ReturnRequestRow[] = [],
  note: string | null = null
) =>
  orderView(o, null, false, t, {
    token: null,
    contracts: [],
    returns,
    returnable,
    shipments: [],
    invoice: null,
    note,
  })

describe("a gift card line on the return form", () => {
  it("is offered on an unshipped order once its cards went out, worded and with the right of withdrawal only", () => {
    const page = view(
      order([giftLine(["AB12", "CD34"])]),
      found([row(GIFT, 2, { gift_card: true })])
    )
    expect(page.returnable).toEqual([
      {
        id: GIFT,
        title: "Hediye kartı",
        quantity: 2,
        excluded: null,
        warning: null,
        gift: true,
        note: "Kartlar iptal edilir ve ödediğiniz tutar iade edilir; bir şey göndermeniz gerekmez.",
      },
    ])
    expect(page.giftReasons).toEqual([{ value: "changed_mind", label: "Cayma hakkı (vazgeçtim)" }])
  })

  it("is not offered before its cards went out, nor once the order is cancelled", () => {
    const before = found([row(GIFT, 0, { gift_card: true })], { window_open: false })
    expect(view(order([giftLine([])]), before).returnable).toBeNull()
    const canceled = found([row(GIFT, 1, { gift_card: true })], { window_open: false })
    expect(
      view(order([giftLine(["AB12"])], "not_fulfilled", "canceled"), canceled).returnable
    ).toBeNull()
  })

  it("offers the units the backend counts as left, and nothing once none is", () => {
    const o = order([giftLine(["AB12", "CD34"])])
    expect(view(o, found([row(GIFT, 1, { gift_card: true })])).returnable?.[0]?.quantity).toBe(1)
    expect(view(o, found([row(GIFT, 0, { gift_card: true })])).returnable).toBeNull()
  })

  it("disappears once its period is over, whatever the line says", () => {
    const closed = found([row(GIFT, 2, { gift_card: true })], { window_open: false })
    expect(view(order([giftLine(["AB12", "CD34"])]), closed).returnable).toBeNull()
  })

  it("keeps the physical lines to what the backend says was shipped, each kind flagged", () => {
    const o = order([knifeLine, giftLine(["AB12"])])
    const unshipped = view(o, found([row(KNIFE, 0), row(GIFT, 1, { gift_card: true })]))
    expect(unshipped.returnable?.map((line) => [line.id, line.gift])).toEqual([[GIFT, true]])
    const shipped = view(o, found([row(KNIFE, 1), row(GIFT, 1, { gift_card: true })]))
    expect(shipped.returnable?.map((line) => [line.id, line.gift, line.note])).toEqual([
      [KNIFE, false, null],
      [GIFT, true, expect.stringContaining("Kartlar iptal edilir")],
    ])
  })

  it("offers nothing when the backend did not say", () => {
    expect(view(order([knifeLine], "delivered"), null).returnable).toBeNull()
  })
})

describe("why a line is outside the right of withdrawal", () => {
  it("words each backend reason; a spent card's line stays, with nothing to choose", () => {
    const sameAsBefore = "Bu satır için cayma hakkı yok; yalnızca ayıplı/yanlış ürün iadesi."
    expect(returnNoteOf("product", false, t)).toBe(sameAsBefore)
    expect(returnNoteOf("personal_addon", false, t)).toBe(sameAsBefore)
    expect(returnNoteOf("gift_card_used", true, t)).toBe("Kart kullanıldığı için cayma hakkı yok.")
    expect(returnNoteOf(null, false, t)).toBeNull()

    const spent = found([row(GIFT, 0, { gift_card: true, reason: "gift_card_used" })])
    expect(returnableOf(spent, order([giftLine(["AB12"])]), t)).toEqual([
      expect.objectContaining({ id: GIFT, quantity: 0, excluded: "gift_card_used", gift: true }),
    ])
    const plain = returnableOf(found([row(KNIFE, 1)]), order([knifeLine], "delivered"), t)
    expect(plain?.[0]?.excluded).toBeNull()
  })

  it("takes the backend's reason for a physical line; one it does not know reads as the product's mark", () => {
    const o = order([knifeLine], "delivered")
    for (const reason of ["product", "personal_addon"]) {
      expect(returnableOf(found([row(KNIFE, 1, { reason })]), o, t)).toEqual([
        expect.objectContaining({
          id: KNIFE,
          quantity: 1,
          excluded: reason,
          note: "Bu satır için cayma hakkı yok; yalnızca ayıplı/yanlış ürün iadesi.",
        }),
      ])
    }
    const unknown = {
      ...row(KNIFE, 1),
      withdrawal_excluded: true,
      withdrawal_excluded_reason: "new",
    }
    expect(returnableOf(found([unknown]), o, t)?.[0]?.excluded).toBe("product")
  })

  it("names a line the backend gave no title by the order's own", () => {
    const untitled = { ...row(KNIFE, 1), title: null }
    expect(returnableOf(found([untitled]), order([knifeLine], "delivered"), t)?.[0]?.title).toBe(
      "Çakı"
    )
  })
})

describe("the cancel button", () => {
  const untouched = found([row(GIFT, 1, { gift_card: true })])
  const used = found([row(GIFT, 0, { gift_card: true, reason: "gift_card_used" })])

  it("shows before packing, with the plain words for an order without gift lines", () => {
    const page = view(order([knifeLine]), found([row(KNIFE, 0)], { window_open: false }))
    expect(page.cancellable).toBe(true)
    expect(page.cancelText).toBe(t("order.cancel_text"))
  })

  it("shows for a gift order while its cards are untouched, saying they are voided and the money refunded", () => {
    for (const page of [
      view(order([giftLine(["AB12"])]), untouched),
      view(
        order([giftLine([])]),
        found([row(GIFT, 0, { gift_card: true })], { window_open: false })
      ),
    ]) {
      expect(page.cancellable).toBe(true)
      expect(page.cancelText).toBe(
        "Siparişiniz henüz hazırlanmadı; isterseniz iptal edebilirsiniz. Gönderilen hediye kartları iptal edilir ve ödediğiniz tutar iade edilir."
      )
    }
  })

  it("hides once a card the order sent was used", () => {
    expect(view(order([knifeLine, giftLine(["AB12"])]), used).cancellable).toBe(false)
  })

  it("hides once the order is packed, shipped, cancelled or completed", () => {
    expect(view(order([giftLine(["AB12"])], "fulfilled"), untouched).cancellable).toBe(false)
    expect(view(order([knifeLine], "shipped"), null).cancellable).toBe(false)
    expect(view(order([knifeLine], "not_fulfilled", "canceled"), null).cancellable).toBe(false)
    expect(view(order([knifeLine], "not_fulfilled", "completed"), null).cancellable).toBe(false)
  })

  it("shows by the window alone when the backend did not say, and lets it decide", () => {
    expect(view(order([giftLine(["AB12"])]), null).cancellable).toBe(true)
  })

  it("says the backend's refusals in its own words after the cancel", () => {
    const o = order([giftLine(["AB12"])])
    expect(view(o, used, [], "iptal-hediye-karti").notice).toBe(
      "Hediye kartı kullanıldığı için sipariş iptal edilemez; iade için mağazayla iletişime geçin."
    )
    expect(view(o, null, [], "iptal-magaza").notice).toBe(
      "Havale/EFT ile ödenmiş sipariş buradan iptal edilemez; iptal ve ücret iadesi için mağazayla iletişime geçin."
    )
    expect(view(o, null, [], "iptal-olmadi").notice).toBe(t("order.notice_cancel_refused"))
    expect(view(o, null, [], "bilinmeyen").notice).toBeNull()
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
    const page = view(order([giftLine(["AB12"])]), null, [
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

  it("knows a gift line by the backend's word when its record says nothing", () => {
    const bare = { ...giftLine(["AB12"]), metadata: null }
    const page = view(order([bare]), found([row(GIFT, 1, { gift_card: true })]), [
      request("received", [{ line_item_id: GIFT, quantity: 1 }]),
    ])
    expect(page.returns[0]?.kind).toBe("Hediye kartı cayması")
    expect(page.cancelText).toBe(t("order.cancel_text_gift"))
  })
})
