import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import type { ReturnRequestRow, ReturnableRow } from "@/lib/orders/order"
import { orderView } from "../order"
import { refusedOf, requestWordsOf, returnableOf } from "../order-returns"
import { productPage, withdrawalNoteOf } from "../product"
import { GIFT, KNIFE, found, knifeLine, order, row } from "@/test/order-fixtures"

/*
 * The right of withdrawal as the distance contracts regulation reads since
 * 1.1.2026 (adr/0032, adr/0052 Ek 2026-11-03), in the storefront's words: a
 * sealed good is asked back like any line, warned; units refused at
 * receipt are named on the request; sending goods back costs nothing; a
 * physical product's seal mark is said before the purchase.
 */

const SEALED =
  "Mühürlü/hijyenik ürün: ambalajı açıldıysa iade edilemez; açılmamış ürünler iade edilebilir."
const FREE_RETURN =
  "İade kargosu ücretsizdir: ürünü mağazanın anlaşmalı kargosuyla gönderdiğinizde sizden kargo ücreti alınmaz."

const delivered = order([knifeLine], "delivered")

const request = (overrides: Partial<ReturnRequestRow> = {}): ReturnRequestRow => ({
  kind: "return",
  status: "received",
  return_code: "RC1",
  created_at: "2026-11-03T12:00:00.000Z",
  items: [{ line_item_id: KNIFE, quantity: 2 }],
  ...overrides,
})

const pageOf = (returnable: ReturnableRow | null, returns: ReturnRequestRow[] = []) =>
  orderView(delivered, null, false, t, {
    token: null,
    contracts: [],
    returns,
    returnable,
    shipments: [],
    invoice: null,
    note: null,
  })

describe("a sealed good on the return form", () => {
  it("is offered inside the right of withdrawal, with its warning under it", () => {
    const lines = returnableOf(found([row(KNIFE, 2, { warning: "sealed_goods" })]), delivered, t)
    expect(lines).toEqual([
      {
        id: KNIFE,
        title: "Çakı",
        quantity: 2,
        excluded: null,
        warning: "sealed_goods",
        gift: false,
        note: SEALED,
      },
    ])
  })

  it("reads a warning this storefront does not know as a sealed good's", () => {
    const lines = returnableOf(found([row(KNIFE, 1, { warning: "later" })]), delivered, t)
    expect(lines?.[0]).toMatchObject({ warning: "sealed_goods", note: SEALED })
  })

  it("lets an exclusion win: a line outside the right warns of nothing", () => {
    const lines = returnableOf(
      found([row(KNIFE, 1, { reason: "personal_addon", warning: "sealed_goods" })]),
      delivered,
      t
    )
    expect(lines?.[0]).toMatchObject({
      excluded: "personal_addon",
      warning: null,
      note: "Bu satır için cayma hakkı yok; yalnızca ayıplı/yanlış ürün iadesi.",
    })
  })

  it("leaves a plain line without a warning, an older backend's too", () => {
    const older = { ...row(KNIFE, 1) }
    delete older.withdrawal_warning
    expect(returnableOf(found([older]), delivered, t)?.[0]).toMatchObject({
      warning: null,
      note: null,
    })
  })

  it("says once, on the page, that sending goods back is free with the shop's carrier", () => {
    expect(pageOf(found([row(KNIFE, 1)])).returnShippingNote).toBe(FREE_RETURN)
  })
})

describe("units refused at receipt", () => {
  const titles = new Map([[KNIFE, "Çakı"]])

  it("names each line refused for an opened seal, by the order's own title", () => {
    const refused = request({
      refused_items: [{ line_item_id: KNIFE, quantity: 1, reason: "unsealed" }],
    })
    expect(refusedOf(refused, titles, t)).toEqual([
      "Çakı: 1 adet ambalajı açılmış olduğu için iade edilmedi.",
    ])
    expect(pageOf(null, [refused]).returns[0]?.refused).toEqual([
      "Çakı: 1 adet ambalajı açılmış olduğu için iade edilmedi.",
    ])
  })

  it("says only 'not taken back' for a reason it does not know, and names an unknown line plainly", () => {
    const refused = request({
      refused_items: [
        { line_item_id: KNIFE, quantity: 2, reason: "other" },
        { line_item_id: "ordli_01K0000000000000000GONE", quantity: 1, reason: "unsealed" },
        { line_item_id: KNIFE, quantity: 0, reason: "unsealed" },
      ],
    })
    expect(refusedOf(refused, titles, t)).toEqual([
      "Çakı: 2 adet iade edilmedi.",
      "Ürün: 1 adet ambalajı açılmış olduğu için iade edilmedi.",
    ])
  })

  it("lists nothing when none was refused", () => {
    expect(refusedOf(request(), titles, t)).toEqual([])
    expect(refusedOf(request({ refused_items: null }), titles, t)).toEqual([])
  })
})

describe("a refund that gave the shipping back", () => {
  const gifts = new Set([GIFT])

  it("says so once the backend tells it was refunded with the shipping", () => {
    const words = (overrides: Partial<ReturnRequestRow>) =>
      requestWordsOf(request(overrides), gifts, t).status
    expect(words({ status: "refunded", refund_shipping: true })).toBe(
      "Ücret, kargo ücretiyle birlikte iade edildi"
    )
    expect(words({ status: "refunded", refund_shipping: false })).toBe("Ücret iade edildi")
    expect(words({ status: "refunded" })).toBe("Ücret iade edildi")
    // Other states keep their own words
    expect(words({ status: "received", refund_shipping: true })).toBe("Teslim alındı")
  })

  it("keeps a gift card withdrawal's words: no shipping goes back with it", () => {
    const gift = request({
      status: "refunded",
      refund_shipping: true,
      items: [{ line_item_id: GIFT, quantity: 1 }],
    })
    expect(requestWordsOf(gift, gifts, t).status).toBe("Kartlar iptal edildi, iade yapıldı")
  })
})

describe("a product's seal mark before the purchase", () => {
  const product = (
    extension: Exclude<StoreProduct["product_extension"], undefined>
  ): StoreProduct => ({
    id: "prod_1",
    title: "Ürün",
    handle: "urun",
    subtitle: null,
    description: null,
    thumbnail: null,
    product_extension: extension,
  })
  const NOTE = "Hijyenik/mühürlü ürün: ambalajı açıldıktan sonra cayma hakkı kullanılamaz."

  it("says it on a marked physical product's page", () => {
    const marked = product({ withdrawal_excluded: true, kind: "physical" })
    expect(withdrawalNoteOf(marked, t)).toBe(NOTE)
    const page = productPage({
      product: marked,
      seo: null,
      displays: {},
      brandPath: null,
      requestedVariant: null,
      t,
      trustBadges: [],
    })
    expect(page.withdrawalNote).toBe(NOTE)
  })

  it("says nothing for a digital or service product's mark, an unmarked one, or one the backend did not answer", () => {
    expect(withdrawalNoteOf(product({ withdrawal_excluded: true, kind: "digital" }), t)).toBeNull()
    expect(withdrawalNoteOf(product({ withdrawal_excluded: true, kind: "service" }), t)).toBeNull()
    expect(withdrawalNoteOf(product({ withdrawal_excluded: true }), t)).toBeNull()
    expect(
      withdrawalNoteOf(product({ withdrawal_excluded: false, kind: "physical" }), t)
    ).toBeNull()
    expect(withdrawalNoteOf(product({ is_gift_card: false }), t)).toBeNull()
    expect(withdrawalNoteOf(product(null), t)).toBeNull()
  })
})
