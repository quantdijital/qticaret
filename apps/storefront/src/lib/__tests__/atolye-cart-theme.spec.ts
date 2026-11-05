import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ActionResult,
  CartLineView,
  CartPageView,
  ProductCardView,
  ThemeActions,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The theme's cart page (design.md § Satın alma sayfaları): the
 * lines with the quantity pill and the bin as plain form buttons, the
 * struck price, free shipping's distance, the totals with the backend's
 * shipping estimate, the shop's offers and promises, products to add, and
 * on a phone the sticky checkout bar. A payment link's cart has no controls.
 */

const done = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })
const nothing = (): Promise<void> => Promise.resolve()

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

const line = (over: Partial<CartLineView> = {}): CartLineView => ({
  id: "cali_01ABCDEFGHJK",
  title: "Kalem Ucu Çakı",
  detail: "Kiremit",
  quantity: 2,
  total: "628,60 TL",
  original: "898,00 TL",
  image: {
    src: "/media/caki.jpg",
    alt: "Kalem Ucu Çakı",
    width: null,
    height: null,
    sources: { avif: null, webp: null },
  },
  addons: [{ label: "İsim gravürü", value: "Ayşe", amount: "+150,00 TL", nonWithdrawable: true }],
  nonWithdrawable: true,
  ...over,
})

const card: ProductCardView = {
  id: "prod_1",
  title: "Av Bıçağı",
  path: "/urun/av-bicagi",
  brand: null,
  image: null,
  price: { current: "1.299,90 TL", before: null, from: false, discount: null },
  available: true,
}

const view = (over: Partial<CartPageView> = {}): CartPageView => ({
  lines: [line()],
  items: "898,00 TL",
  discount: "269,40 TL",
  subtotal: "628,60 TL",
  promotions: ["YAZ10"],
  freeShipping: {
    message: "Ücretsiz kargo için 871,40 TL daha ekleyin",
    percent: 41,
    reached: false,
  },
  error: null,
  shipping: "85,00 TL'den başlayan",
  offers: ["2.000,00 TL ve üzeri sepette %10 indirim"],
  trust: [{ icon: "truck", title: "Aynı gün kargo", text: "Hafta içi 16:00'a kadar" }],
  upsell: { title: "Çok satanlar", products: [card] },
  ...over,
})

describe("the theme's cart page", () => {
  it("draws the lines as plain forms with their pill, bin and struck price", () => {
    const html = renderPage(atolyeTheme, "CartPage", { view: view(), actions })
    expect(html).toContain("<h1")
    expect(html).toContain("Sepetim")
    expect(html).toContain('name="line_id" value="cali_01ABCDEFGHJK"')
    expect(html.match(/ürününü sepetten kaldır/g)).toHaveLength(1)
    expect(html).toContain("898,00 TL")
    expect(html).toContain("Kişiye özel ürün: cayma hakkı yok.")
  })

  it("prices shipping as the backend estimated it, with the offers, promises and code field", () => {
    const html = renderPage(atolyeTheme, "CartPage", { view: view(), actions })
    expect(html).toContain("85,00 TL&#x27;den başlayan")
    expect(html).toContain("2.000,00 TL ve üzeri sepette %10 indirim")
    expect(html).toContain("Aynı gün kargo")
    expect(html).toContain('for="kupon"')
    expect(html).toContain("YAZ10")
    expect(html).toContain("−269,40 TL")
  })

  it("keeps the phone's checkout bar and the products to add", () => {
    const html = renderPage(atolyeTheme, "CartPage", { view: view(), actions })
    expect(html).toContain("data-sticky-buy")
    expect(html.match(/href="\/odeme"/g)).toHaveLength(2)
    expect(html).toContain("Çok satanlar")
    expect(html).toContain('href="/urun/av-bicagi"')
  })

  it("says shipping comes at checkout without an estimate", () => {
    const html = renderPage(atolyeTheme, "CartPage", {
      view: view({ shipping: null, offers: [], trust: [], upsell: null }),
      actions,
    })
    expect(html).toContain("Ödeme adımında")
    expect(html).not.toContain("Sepet kampanyaları")
  })

  it("gives a payment link's cart no controls and no code field", () => {
    const html = renderPage(atolyeTheme, "CartPage", {
      view: view({ locked: "Bu sepet mağazanın size gönderdiği ödeme bağlantısından geldi." }),
      actions: { ...actions, leaveLinkCart: nothing },
    })
    expect(html).not.toContain("Adedi artır")
    expect(html).not.toContain("sepetten kaldır")
    expect(html).not.toContain("İndirim kodu")
    expect(html).toContain("Adet: 2")
    expect(html).toContain("Başka bir alışveriş için")
  })

  it("is an empty well, the way back and what sells when the cart is empty", () => {
    const html = renderPage(atolyeTheme, "CartPage", { view: view({ lines: [] }), actions })
    expect(html.match(/Sepetiniz boş\./g)).toHaveLength(1)
    expect(html).toContain("Alışverişe devam et")
    expect(html).toContain("Çok satanlar")
  })
})
