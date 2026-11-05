import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { CartLineView, MiniCartView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The drawer opens in a portal the server never prints; its body is rendered on its own
import { CartSheetBody } from "../../../../../packages/themes/atolye/src/frame/CartSheet"
import { cartSheetWords } from "../../../../../packages/themes/atolye/src/frame/cart-sheet-words"

/**
 * The theme's cart drawer (design.md § Satın alma sayfaları): each line
 * with its quantity pill and bin as the line form's own buttons (the
 * storefront's `changeCartLine`), its struck price and picks; free
 * shipping's distance, the subtotal, "Ödemeye geç" and "Sepete git";
 * empty, the shop's categories as picture tiles.
 */

const nothing = (): Promise<void> => Promise.resolve()

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

const drawer = (cart: MiniCartView | null, change?: (form: FormData) => Promise<void>) =>
  renderToStaticMarkup(
    createElement(CartSheetBody, {
      cart,
      categories: [{ label: "Çakılar", path: "/kategori/cakilar" }],
      change,
      words: cartSheetWords(t, cart?.lines.length ?? 0),
    })
  )

describe("the theme's cart drawer", () => {
  const mini: MiniCartView = {
    lines: [line()],
    subtotal: "628,60 TL",
    freeShipping: {
      message: "Ücretsiz kargo için 871,40 TL daha ekleyin",
      percent: 41,
      reached: false,
    },
  }

  it("gives each line its quantity pill and bin, its struck price and picks", () => {
    const html = drawer(mini, nothing)
    expect(html).toContain('aria-label="Kalem Ucu Çakı adedi"')
    expect(html).toMatch(/value="1" aria-label="Adedi azalt"[^>]*name="quantity"/)
    expect(html).toMatch(/value="3" aria-label="Adedi artır"[^>]*name="quantity"/)
    expect(html).toContain('aria-label="Kalem Ucu Çakı ürününü sepetten kaldır"')
    expect(html).toContain("<s")
    expect(html).toContain("898,00 TL")
    expect(html).toContain("İsim gravürü")
    expect(html).toContain("Ücretsiz kargo için 871,40 TL daha ekleyin")
  })

  it("ends on the subtotal, Ödemeye geç and Sepete git", () => {
    const html = drawer(mini, nothing)
    expect(html).toMatch(/<a href="\/odeme" class="gf-btn w-full">Ödemeye geç<\/a>/)
    expect(html).toContain('href="/sepet"')
    expect(html).toContain("Sepete git")
  })

  it("reads only without the action or for a payment link's cart", () => {
    expect(drawer(mini)).not.toContain("Adedi artır")
    const locked = drawer({ ...mini, locked: "Bu sepet ödeme bağlantısından geldi." }, nothing)
    expect(locked).not.toContain("Adedi artır")
    expect(locked).toContain("2 adet")
  })

  it("offers the shop's categories as picture tiles when empty", () => {
    const html = drawer(null)
    expect(html).toContain("Sepetiniz boş.")
    expect(html).toContain('href="/kategori/cakilar"')
    expect(html).toContain("Alışverişe devam et")
  })
})
