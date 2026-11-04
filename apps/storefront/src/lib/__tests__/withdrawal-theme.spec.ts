import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { baseTheme } from "@qticaret/theme-base"
import type { OrderActions, ProductPageView, ThemeActions } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import type { ReturnRequestRow, ReturnableRow, StoreOrder } from "@/lib/orders/order"
import { orderView } from "@/lib/views/order"
import { withdrawalNoteOf } from "@/lib/views/product"
import { GIFT, KNIFE, found, giftLine, knifeLine, order, row } from "@/test/order-fixtures"

/**
 * The right of withdrawal since 1.1.2026 (adr/0032, adr/0052 Ek
 * 2026-11-03) as the base theme prints it: a sealed good chosen like any
 * line with its warning, the free return shipping on the shipped lines'
 * form only, the units refused at receipt under their request, and a
 * product's withdrawal mark beside the cart form: a physical product's
 * seal, a digital or service product's missing right.
 */

const SEALED =
  "Mühürlü/hijyenik ürün: ambalajı açıldıysa iade edilemez; açılmamış ürünler iade edilebilir."
const FREE_RETURN = "İade kargosu ücretsizdir"

const orderActions: OrderActions = {
  cancelOrder: () => Promise.resolve(),
  requestReturn: () => Promise.resolve({ ok: true, error: null }),
}

const renderOrder = (
  o: StoreOrder,
  returnable: ReturnableRow | null,
  returns: ReturnRequestRow[] = []
) =>
  renderToStaticMarkup(
    createElement(baseTheme.OrderPage, {
      t,
      actions: orderActions,
      view: orderView(o, null, false, t, {
        token: null,
        contracts: [],
        returns,
        returnable,
        shipments: [],
        invoice: null,
        note: null,
      }),
    })
  )

const forms = (html: string) => html.split("<form").slice(1)

describe("the base theme's return form for a sealed good", () => {
  it("lets the line be chosen, every reason and the exchange offered, its warning tied to it", () => {
    const html = renderOrder(
      order([knifeLine], "delivered"),
      found([
        {
          ...row(KNIFE, 2, { warning: "sealed_goods" }),
          variants: [{ id: "variant_buyuk", title: "Büyük" }],
        },
      ])
    )
    const [form, ...rest] = forms(html)
    expect(rest).toHaveLength(0)
    expect(form).toContain(`name="qty_${KNIFE}"`)
    expect(form).toContain(`<option value="2">2</option>`)
    expect(form).toContain(`aria-describedby="note_${KNIFE}"`)
    expect(form).toContain(`id="note_${KNIFE}"`)
    expect(form).toContain(SEALED)
    for (const reason of ["changed_mind", "size_issue", "damaged"]) {
      expect(form).toContain(`value="${reason}"`)
    }
    expect(form).toMatch(/<input type="radio" name="kind" value="exchange"(?![^>]*disabled)/)
    // A product with no other variant has nothing to exchange for (adr/0032 §6)
    const [single] = forms(
      renderOrder(
        order([knifeLine], "delivered"),
        found([row(KNIFE, 2, { warning: "sealed_goods" })])
      )
    )
    expect(single).toMatch(/<input type="radio" disabled="" name="kind" value="exchange"/)
  })

  it("says the return shipping is free once, on the shipped lines' form, and not on a gift card's", () => {
    const html = renderOrder(
      order([knifeLine, giftLine(["AB12"])], "delivered"),
      found([row(KNIFE, 1), row(GIFT, 1, { gift_card: true })])
    )
    const [goods, gift] = forms(html)
    expect(goods).toContain(FREE_RETURN)
    expect(gift).not.toContain(FREE_RETURN)
    expect(html.split(FREE_RETURN)).toHaveLength(2)
  })

  it("leaves a line without a note undescribed", () => {
    const [form] = forms(renderOrder(order([knifeLine], "delivered"), found([row(KNIFE, 1)])))
    expect(form).not.toContain("aria-describedby")
    expect(form).not.toContain(SEALED)
  })
})

describe("the base theme's return requests", () => {
  const made = (
    refused: NonNullable<ReturnRequestRow["refused_items"]> | null
  ): ReturnRequestRow => ({
    kind: "return",
    status: "received",
    return_code: "RC1",
    created_at: "2026-11-03T12:00:00.000Z",
    items: [{ line_item_id: KNIFE, quantity: 2 }],
    refused_items: refused,
  })

  it("names the units refused at receipt under their request", () => {
    const html = renderOrder(order([knifeLine], "delivered"), null, [
      made([{ line_item_id: KNIFE, quantity: 1, reason: "unsealed" }]),
    ])
    const section = html.slice(html.indexOf('aria-labelledby="iadeler"'))
    expect(section).toContain("İade · Teslim alındı")
    expect(section).toContain("<li>Çakı: 1 adet ambalajı açılmış olduğu için iade edilmedi.</li>")
  })

  it("prints no list when nothing was refused", () => {
    const html = renderOrder(order([knifeLine], "delivered"), null, [made(null)])
    const section = html.slice(html.indexOf('aria-labelledby="iadeler"'))
    expect(section).not.toContain("iade edilmedi")
    expect(section).not.toContain('<ul class="mt-1')
  })
})

describe("the base theme's product page with a seal mark", () => {
  const refused = () => Promise.resolve({ ok: false, error: null, challenge: null })
  const actions: ThemeActions = {
    addToCart: refused,
    changeCartLine: () => Promise.resolve(),
    applyPromotion: refused,
    removePromotion: () => Promise.resolve(),
    writeReview: refused,
    askQuestion: refused,
    stockAlert: refused,
    addFavorite: refused,
    installments: () => Promise.resolve(null),
  }
  const NOTE = "Hijyenik/mühürlü ürün: ambalajı açıldıktan sonra cayma hakkı kullanılamaz."
  const view = (withdrawalNote?: string | null): ProductPageView => ({
    id: "prod_1",
    title: "Ürün",
    subtitle: null,
    description: [],
    descriptionHtml: null,
    brand: null,
    breadcrumbs: [],
    images: [],
    options: [],
    variants: [],
    selectedVariantId: null,
    specs: [],
    trustBadges: [],
    reviews: { average: null, count: 0, items: [] },
    questions: { count: 0, items: [] },
    related: [],
    whatsappHref: null,
    signedIn: false,
    loginPath: "/hesap/giris",
    shippingNote: null,
    ...(withdrawalNote === undefined ? {} : { withdrawalNote }),
  })
  const render = (page: ProductPageView) =>
    renderToStaticMarkup(createElement(baseTheme.ProductPage, { t, view: page, actions }))

  const EXCLUDED = "Bu ürün için cayma hakkı bulunmaz (dijital içerik / hizmet)."
  const noteFor = (kind: string, marked = true) =>
    withdrawalNoteOf(
      {
        id: "prod_1",
        title: "Ürün",
        handle: "urun",
        subtitle: null,
        description: null,
        thumbnail: null,
        product_extension: { withdrawal_excluded: marked, kind },
      },
      t
    )

  it("says it beside the cart form, before the favourite button", () => {
    const html = render(view(NOTE))
    expect(html).toContain(`<p class="text-sm font-medium">${NOTE}</p>`)
    expect(html.indexOf(NOTE)).toBeLessThan(html.indexOf(t("product.favorite_add")))
  })

  it("prints a marked physical product's seal, and a digital or service one's missing right, in the same place", () => {
    expect(render(view(noteFor("physical")))).toContain(
      `<p class="text-sm font-medium">${NOTE}</p>`
    )
    for (const kind of ["digital", "service"]) {
      const html = render(view(noteFor(kind)))
      expect(html).toContain(`<p class="text-sm font-medium">${EXCLUDED}</p>`)
      expect(html).not.toContain("mühürlü")
      expect(html.indexOf(EXCLUDED)).toBeLessThan(html.indexOf(t("product.favorite_add")))
    }
  })

  it("says nothing without one", () => {
    expect(render(view(null))).not.toContain("cayma hakkı")
    expect(render(view())).not.toContain("cayma hakkı")
    for (const kind of ["physical", "digital", "service"]) {
      expect(render(view(noteFor(kind, false)))).not.toContain("cayma hakkı")
    }
  })
})
