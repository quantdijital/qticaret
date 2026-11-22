import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  ActionResult,
  BookingView,
  CartLineView,
  CartPageView,
  ProductPageView,
  ThemeActions,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * A dated product in the Grafit theme (adr/0076 §10): with `booking` the
 * buy column is the departures as one radio group, the counts per price
 * category, a shown total and "Rezervasyon yap"; without it, or without
 * the storefront's action, the page is drawn exactly as before (adr/0066
 * K6). A dated cart line has no stepper; the hold ticks by the totals.
 */

const done = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })
const nothing = (): Promise<void> => Promise.resolve()

const base: ThemeActions = {
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
const actions: ThemeActions = { ...base, addBookingToCart: done }

const product = (over: Partial<ProductPageView> = {}): ProductPageView => ({
  id: "prod_01TUR",
  title: "Kapadokya Günübirlik Tur",
  subtitle: null,
  description: ["Balon, vadi ve yer altı şehri."],
  descriptionHtml: null,
  brand: null,
  breadcrumbs: [{ label: "Ana sayfa", path: "/" }],
  images: [],
  options: [{ id: "opt_kisi", title: "Kişi", values: ["Yetişkin", "Bebek"] }],
  variants: [
    {
      id: "variant_yetiskin",
      title: "Yetişkin",
      options: { opt_kisi: "Yetişkin" },
      price: { current: "1.500,00 TL", before: null, from: false, discount: null },
      kurus: 150000,
      available: true,
      sku: null,
    },
  ],
  selectedVariantId: "variant_yetiskin",
  specs: [],
  trustBadges: [],
  reviews: { average: null, count: 0, items: [] },
  questions: { count: 0, items: [] },
  related: [],
  whatsappHref: null,
  signedIn: false,
  loginPath: "/hesap/giris",
  shippingNote: null,
  ...over,
})

const booking = (over: Partial<BookingView> = {}): BookingView => ({
  categories: [
    { variantId: "variant_yetiskin", title: "Yetişkin", pax: 1, ages: null },
    { variantId: "variant_bebek", title: "Bebek", pax: 0, ages: "2 yaşa kadar" },
  ],
  departures: [
    {
      id: "bkslot_kapali",
      startsAt: "2026-12-05T06:00:00.000Z",
      label: "Cumartesi, 5 Aralık 2026 · 09:00",
      available: 0,
      status: "closed",
      prices: [],
    },
    {
      id: "bkslot_dolu",
      startsAt: "2026-12-06T06:00:00.000Z",
      label: "Pazar, 6 Aralık 2026 · 09:00",
      available: 0,
      status: "open",
      prices: [{ variantId: "variant_yetiskin", price: "1.750,50 TL", kurus: 175050 }],
    },
    {
      id: "bkslot_az",
      startsAt: "2026-12-12T06:00:00.000Z",
      label: "Cumartesi, 12 Aralık 2026 · 09:00",
      available: 3,
      status: "open",
      prices: [
        { variantId: "variant_yetiskin", price: "1.750,50 TL", kurus: 175050 },
        { variantId: "variant_bebek", price: "100,00 TL", kurus: 10000 },
      ],
    },
  ],
  fewLeft: 5,
  maxUnits: 20,
  ...over,
})

const page = (view: ProductPageView, with_ = actions) =>
  renderPage(atolyeTheme, "ProductPage", { view, actions: with_ })

describe("a dated product's page", () => {
  it("is drawn as before without `booking`, with it null, or without the action (K6)", () => {
    const plain = page(product())
    expect(page(product({ booking: null }))).toBe(plain)
    expect(page(product({ booking: booking() }), base)).toBe(page(product(), base))
    expect(plain).toContain("Sepete ekle")
    expect(plain).not.toContain("Rezervasyon yap")
  })

  it("offers the departures as one radio group, closed and full ones off with their reason", () => {
    const html = page(product({ booking: booking() }))
    expect(html).not.toContain("Sepete ekle")
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain("Tarih seçin")
    expect(html.match(/name="slot_id"/g)).toHaveLength(3)
    expect(html).toMatch(/id="kalkis-bkslot_kapali"[^>]*disabled/)
    expect(html).toMatch(/id="kalkis-bkslot_dolu"[^>]*disabled/)
    expect(html).toContain("Satışa kapalı")
    expect(html).toContain("Dolu")
    // The soonest that can be picked is chosen; few places said so
    expect(html).toMatch(/checked=""[^>]*id="kalkis-bkslot_az"|id="kalkis-bkslot_az"[^>]*checked/)
    expect(html).toContain("Son 3 yer")
    expect(html).toContain('<time dateTime="2026-12-12T06:00:00.000Z">')
  })

  it("counts each category with its ages and price, and shows the total as a hint", () => {
    const html = page(product({ booking: booking() }))
    expect(html).toContain("Kişi sayısı")
    expect(html).toContain('name="qty_variant_yetiskin" value="1"')
    expect(html).toContain('name="qty_variant_bebek" value="0"')
    expect(html).toContain("2 yaşa kadar · Yer tutmaz")
    expect(html).toContain('aria-label="Yetişkin sayısı"')
    // One adult on the chosen departure; the total is announced as it changes
    expect(html).toMatch(/aria-live="polite"[^>]*>.*Toplam.*1 kişi.*1\.750,50/s)
    expect(html).toContain("Kesin tutar sepette hesaplanır.")
    expect(html).toContain("Rezervasyon yap")
    // Never a price field in the form
    expect(html).not.toMatch(/name="(?:unit_)?price/)
  })

  it("says new dates are coming when there is no departure; the page stays", () => {
    const html = page(product({ booking: booking({ departures: [] }) }))
    expect(html).toContain("Yakında yeni tarihler")
    expect(html).not.toContain("Rezervasyon yap")
    expect(html).not.toContain("Sepete ekle")
    expect(html).toContain("Kapadokya Günübirlik Tur")
  })
})

const line = (over: Partial<CartLineView> = {}): CartLineView => ({
  id: "cali_01TURSATIRI",
  title: "Kapadokya Günübirlik Tur",
  detail: "Yetişkin",
  quantity: 2,
  total: "3.501,00 TL",
  original: null,
  image: null,
  path: "/urun/kapadokya?variant=variant_yetiskin",
  addons: [],
  nonWithdrawable: false,
  ...over,
})

const cart = (over: Partial<CartPageView> = {}): CartPageView => ({
  lines: [line({ booking: { departure: "Cumartesi, 12 Aralık 2026 · 09:00", expired: false } })],
  items: "3.501,00 TL",
  discount: null,
  subtotal: "3.501,00 TL",
  promotions: [],
  freeShipping: null,
  error: null,
  ships: false,
  ...over,
})

describe("a dated line in the cart", () => {
  it("shows its departure, no stepper, a way back to the product and the bin", () => {
    const html = renderPage(atolyeTheme, "CartPage", { view: cart(), actions })
    expect(html).toContain("Cumartesi, 12 Aralık 2026 · 09:00")
    expect(html).not.toContain("Kapadokya Günübirlik Tur adedi")
    expect(html).toContain("Adet: 2")
    expect(html).toContain('href="/urun/kapadokya?variant=variant_yetiskin"')
    expect(html).toContain("Değiştir")
    expect(html).toContain('name="remove"')
  })

  it("draws a plain line as before (no departure, its stepper)", () => {
    const html = renderPage(atolyeTheme, "CartPage", {
      view: cart({ lines: [line()] }),
      actions,
    })
    expect(html).toContain("Kapadokya Günübirlik Tur adedi")
    expect(html).not.toContain("Değiştir")
  })

  it("ticks the hold by the totals and draws the payment off once it is gone", () => {
    const later = new Date(Date.now() + 7 * 60 * 1000 + 5000).toISOString()
    const live = renderPage(atolyeTheme, "CartPage", {
      view: cart({ hold: { expiresAt: later } }),
      actions,
    })
    expect(live).toContain("Yerleriniz ")
    expect(live).toMatch(/role="timer"[^>]*>0[67]:\d\d</)
    expect(live).toContain('href="/odeme"')

    const gone = renderPage(atolyeTheme, "CartPage", {
      view: cart({
        lines: [line({ booking: { departure: "Cumartesi", expired: true } })],
        hold: { expiresAt: null },
      }),
      actions,
    })
    expect(gone).toContain("Süresi doldu — yeniden seçin")
    expect(gone).toContain("Yer ayırma süreniz doldu; tarihleri yeniden seçin.")
    expect(gone).not.toContain('href="/odeme"')
    expect(gone).toContain('aria-disabled="true"')
  })
})
