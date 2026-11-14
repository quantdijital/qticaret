import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type {
  HomeSectionView,
  ProductCardView,
  ProductPageView,
  ReviewsPageView,
  ShopRatingView,
  ThemeActions,
} from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * adr/0046 Ek 2026-11-05 as the theme prints it: one product up close,
 * the shop's reviews in short, a cart offer beside the product's price.
 * Every field optional: without them the page is the page it was.
 */

const card: ProductCardView = {
  id: "prod_1",
  title: "Şef Bıçağı",
  path: "/urun/sef-bicagi",
  brand: null,
  image: null,
  // An automatic promotion's price, struck through at the price before it
  price: { current: "1.224,30 TL", before: "1.749,00 TL", from: false, discount: 30 },
  available: true,
}

const featured: HomeSectionView = {
  id: "yakin",
  type: "featured_product",
  title: null,
  text: "Mutfağın en çok kullanılanı.",
  product: card,
  subtitle: "El yapımı",
  images: [],
  facts: [{ label: "Çelik", value: "N690", highlight: true }],
  specGroups: [
    { title: "Bıçak", rows: [{ label: "Uzunluk", value: "21 cm", highlight: false }] },
    { title: null, rows: [{ label: "Sap", value: "Ceviz", highlight: false }] },
  ],
}

const summary: ShopRatingView = {
  average: "4,6",
  count: 5,
  label: "5 üzerinden 4,6 (5 değerlendirme)",
  distribution: [5, 4, 3, 2, 1].map((stars) => ({
    stars: stars as 1 | 2 | 3 | 4 | 5,
    count: stars === 5 ? 3 : stars === 4 ? 2 : 0,
    percent: stars === 5 ? 60 : stars === 4 ? 40 : 0,
    label: `${String(stars)} yıldız`,
  })),
}

const reviews = (over: Partial<Extract<HomeSectionView, { type: "reviews" }>> = {}) =>
  ({
    id: "yorum",
    type: "reviews",
    title: "Müşterilerimiz ne diyor?",
    reviews: [
      {
        rating: 5,
        title: null,
        body: "Çok keskin.",
        author: "Ayşe Y.",
        date: "1 Kasım 2026",
        verified: true,
        product: null,
      },
    ],
    more: { label: "Tüm yorumlar", path: "/yorumlar" },
    ...over,
  }) satisfies HomeSectionView

describe("the home page's new optional sections and fields", () => {
  it("draws a featured product up close with its price, facts, line and link", () => {
    const html = renderPage(atolyeTheme, "HomePage", { view: { sections: [featured] } })
    expect(html).toContain('href="/urun/sef-bicagi"')
    expect(html).toContain("1.224,30 TL")
    expect(html).toContain("1.749,00 TL")
    expect(html).toContain("N690")
    expect(html).toContain("Mutfağın en çok kullanılanı.")
    expect(html).toContain('class="gf-stage')
  })

  it("puts the shop's rating above the reviews only when the view has it", () => {
    const withSummary = renderPage(atolyeTheme, "HomePage", {
      view: { sections: [reviews({ summary })] },
    })
    const without = renderPage(atolyeTheme, "HomePage", { view: { sections: [reviews()] } })
    expect(withSummary).toContain("5 üzerinden 4,6 (5 değerlendirme)")
    expect(withSummary).toContain('aria-label="Puan dağılımı"')
    expect(without).not.toContain("Puan dağılımı")
  })

  it("quotes a review whole on the home page, cutting only a very long one", () => {
    const draw = (body: string) =>
      renderPage(atolyeTheme, "HomePage", {
        view: {
          sections: [reviews({ reviews: reviews().reviews.map((one) => ({ ...one, body })) })],
        },
      })
    const whole = draw("Ürünün kalitesine diyecek bir şey yok. Kutusu ve kılıfı da çok özenli.")
    expect(whole).toContain(
      "Ürünün kalitesine diyecek bir şey yok. Kutusu ve kılıfı da çok özenli."
    )
    const long = draw(`${"Çok keskin ve dengeli bir bıçak. ".repeat(30)}Sonuncu cümle.`)
    expect(long).toContain("…")
    expect(long).not.toContain("Sonuncu cümle.")
  })

  it("draws the shop-wide rating on the reviews page", () => {
    const view: ReviewsPageView = {
      title: "Müşteri yorumları",
      breadcrumbs: [],
      average: 4.6,
      count: 5,
      summary,
      reviews: [],
      pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: {} },
    }
    const html = renderPage(atolyeTheme, "ReviewsPage", { view })
    expect(html).toContain("5 değerlendirme")
    expect(html).toContain('aria-label="Puan dağılımı"')
    const plain = renderPage(atolyeTheme, "ReviewsPage", { view: { ...view, summary: null } })
    expect(plain).toContain("Ortalama 5 üzerinden 4.6")
  })
})

describe("a cart offer beside the product's price", () => {
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
  const page = (cartOffer?: string): ProductPageView => ({
    id: "prod_1",
    title: "Şef Bıçağı",
    subtitle: null,
    description: [],
    descriptionHtml: null,
    brand: null,
    breadcrumbs: [],
    images: [],
    options: [],
    variants: [
      {
        id: "variant_1",
        title: "Standart",
        options: {},
        price: {
          current: "1.749,00 TL",
          before: null,
          from: false,
          discount: null,
          ...(cartOffer ? { cartOffer } : {}),
        },
        available: true,
        sku: null,
      },
    ],
    selectedVariantId: "variant_1",
    specs: [],
    trustBadges: [],
    reviews: { average: null, count: 0, items: [] },
    questions: { count: 0, items: [] },
    related: [],
    whatsappHref: null,
    signedIn: false,
    loginPath: "/hesap/giris",
    shippingNote: null,
  })

  it("says the offer under the price, never in its place", () => {
    const words = "2.000,00 TL ve üzeri sepette %10 indirim"
    const html = renderPage(atolyeTheme, "ProductPage", { view: page(words), actions })
    expect(html).toContain(words)
    expect(html).toContain("1.749,00 TL")
    const plain = renderPage(atolyeTheme, "ProductPage", { view: page(), actions })
    expect(plain).not.toContain("sepette")
  })
})
