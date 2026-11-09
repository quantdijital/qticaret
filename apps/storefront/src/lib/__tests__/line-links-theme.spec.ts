import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type {
  CartLineView,
  CheckoutSummaryView,
  OrderLineView,
  OrderPageView,
  ThemeActions,
} from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The drawer opens in a portal the server never prints; its parts are rendered on their own
import { CartLine } from "../../../../../packages/themes/atolye/src/cart/CartLine"
import { Summary } from "../../../../../packages/themes/atolye/src/checkout/Summary"
import { CartSheetBody } from "../../../../../packages/themes/atolye/src/frame/CartSheet"
import { cartSheetWords } from "../../../../../packages/themes/atolye/src/frame/cart-sheet-words"
import { OrderLines } from "../../../../../packages/themes/atolye/src/order/OrderParts"

/**
 * A bought line links to its product's page (2026-11-05): in the drawer,
 * on the cart page, beside the checkout and on the order, its photograph
 * and its name are one link (the photograph's copy hidden from the reader
 * and the Tab key), with the quantity pill, the bin and the picks' editors
 * outside it. A line without a page reads as text.
 */

const PATH = "/urun/kalem-ucu-caki?variant=variant_kiremit"
const nothing = (): Promise<void> => Promise.resolve()
const done = () => Promise.resolve({ ok: true, error: null })

const actions: ThemeActions = {
  addToCart: done,
  changeCartLine: nothing,
  applyPromotion: done,
  removePromotion: nothing,
  writeReview: done,
  askQuestion: done,
  stockAlert: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  addFavorite: done,
  installments: () => Promise.resolve(null),
}

const image = {
  src: "/media/caki.jpg",
  alt: "Kalem Ucu Çakı",
  width: null,
  height: null,
  sources: { avif: null, webp: null },
}

const line = (over: Partial<CartLineView> = {}): CartLineView => ({
  id: "cali_01ABCDEFGHJK",
  title: "Kalem Ucu Çakı",
  detail: "Kiremit",
  quantity: 2,
  total: "628,60 TL",
  original: null,
  image,
  addons: [],
  nonWithdrawable: false,
  path: PATH,
  ...over,
})

const escaped = PATH.replace(/[?/]/g, (char) => `\\${char}`)
/** The photograph's link: out of the reader's and the Tab key's way. */
const PHOTO = new RegExp(`<a href="${escaped}" tabindex="-1" aria-hidden="true" class="block `)
/** The name's link, the line's one stop. */
const NAME = new RegExp(`<a href="${escaped}"[^>]*>Kalem Ucu Çakı</a>`)
/** A control inside a link. */
const NESTED = /<a [^>]*>(?:(?!<\/a>)[\s\S])*<(?:button|input|select|textarea|form)\b/

const links = (html: string) => html.split(`href="${PATH}"`).length - 1

const drawer = (lines: CartLineView[], locked: string | null = null) =>
  renderToStaticMarkup(
    createElement(CartSheetBody, {
      cart: { lines, subtotal: "628,60 TL", freeShipping: null, locked },
      categories: [],
      change: nothing,
      words: cartSheetWords(t, lines.length),
    })
  )

describe("the theme's bought lines", () => {
  it("link the drawer's photograph and name, the pill and the bin outside them", () => {
    const html = drawer([line()])
    expect(html).toMatch(PHOTO)
    expect(html).toMatch(NAME)
    expect(links(html)).toBe(2)
    expect(html).toContain('aria-label="Kalem Ucu Çakı adedi"')
    expect(html).not.toMatch(NESTED)
  })

  it("link a payment link's lines too, and leave a line without a page as text", () => {
    expect(links(drawer([line()], "Bu sepet ödeme bağlantısından geldi."))).toBe(2)
    const plain = drawer([line({ path: null })])
    expect(plain).toContain("Kalem Ucu Çakı")
    expect(plain).not.toContain('href="/urun')
  })

  it("link the cart page's lines, outside the line's form", () => {
    const render = (view: CartLineView, locked = false) =>
      renderToStaticMarkup(createElement(CartLine, { line: view, t, actions, locked }))
    const html = render(line())
    expect(html).toMatch(PHOTO)
    expect(html).toMatch(NAME)
    expect(links(html)).toBe(2)
    expect(html).not.toMatch(NESTED)
    expect(links(render(line(), true))).toBe(2)
    expect(render(line({ path: null }))).not.toContain("<a ")
  })

  it("link the checkout's summary and the order's lines", () => {
    const summary: CheckoutSummaryView = {
      lines: [{ ...line(), addons: [] }],
      items: "628,60 TL",
      discount: null,
      shipping: null,
      total: "628,60 TL",
    }
    const aside = renderToStaticMarkup(createElement(Summary, { summary, t }))
    expect(aside).toMatch(PHOTO)
    expect(aside).toMatch(NAME)
    const bought: OrderLineView = {
      title: "Kalem Ucu Çakı",
      detail: "Kiremit",
      quantity: 1,
      total: "314,30 TL",
      image,
      path: PATH,
      addons: [],
      nonWithdrawable: false,
    }
    const order = renderToStaticMarkup(
      createElement(OrderLines, { view: { lines: [bought] } as OrderPageView, t })
    )
    expect(order).toMatch(PHOTO)
    expect(order).toMatch(NAME)
    const gone = renderToStaticMarkup(
      createElement(OrderLines, {
        view: { lines: [{ ...bought, path: null }] } as OrderPageView,
        t,
      })
    )
    expect(gone).not.toContain('href="/urun')
  })
})
