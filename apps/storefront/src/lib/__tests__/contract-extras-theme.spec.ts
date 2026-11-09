import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ListingPageView, ProductCardView, ProductPageView, ThemeActions } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * adr/0046 Ek 2026-11-04 as the theme prints it: every field
 * optional, so the page without them is the page it was; with them, a
 * "few left" label, quick add, sectioned specs, the stars' spread and a
 * review's photos.
 */

const refused = () => Promise.resolve({ ok: false, error: null, challenge: null })
const nothing = () => Promise.resolve()
const actions: ThemeActions = {
  addToCart: refused,
  changeCartLine: nothing,
  applyPromotion: refused,
  removePromotion: nothing,
  writeReview: refused,
  askQuestion: refused,
  stockAlert: refused,
  addFavorite: refused,
  installments: () => Promise.resolve(null),
}

const card = (over: Partial<ProductCardView> = {}): ProductCardView => ({
  id: "prod_1",
  title: "Çakı",
  path: "/urun/caki",
  brand: null,
  image: null,
  price: { current: "100,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const listing = (products: ProductCardView[]): ListingPageView => ({
  title: "Bıçaklar",
  description: [],
  breadcrumbs: [],
  subcategories: [
    {
      label: "Mutfak",
      path: "/kategori/mutfak",
      image: {
        src: "https://cdn.example.com/mutfak.png",
        alt: "Mutfak",
        width: 64,
        height: 64,
        sources: { avif: null, webp: null },
      },
    },
  ],
  products,
  total: products.length,
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: {} },
  sort: [],
  filters: [],
  price: null,
  active: [],
  clearPath: null,
})

const renderListing = (view: ListingPageView, quickAdd?: ThemeActions["addToCart"]) =>
  renderToStaticMarkup(
    createElement(atolyeTheme.ListingPage, { t, view, ...(quickAdd ? { quickAdd } : {}) })
  )

const product = (over: Partial<ProductPageView> = {}): ProductPageView => ({
  id: "prod_1",
  title: "Çakı",
  subtitle: null,
  description: [],
  descriptionHtml: null,
  brand: null,
  breadcrumbs: [],
  images: [],
  options: [],
  variants: [],
  selectedVariantId: null,
  specs: [
    { label: "Uzunluk", value: "21 cm", highlight: false },
    { label: "Sap ağacı", value: "Ceviz", highlight: false },
  ],
  trustBadges: [],
  reviews: { average: null, count: 0, items: [] },
  questions: { count: 0, items: [] },
  related: [],
  whatsappHref: null,
  signedIn: true,
  loginPath: "/hesap/giris",
  shippingNote: null,
  ...over,
})

const renderProduct = (view: ProductPageView) =>
  renderToStaticMarkup(createElement(atolyeTheme.ProductPage, { t, view, actions }))

describe("the theme with the contract's optional fields", () => {
  it("says few left on a low card and offers quick add only with both its variant and the action", () => {
    const low = card({ stock: "low", quickAdd: { variantId: "variant_1" } })
    const withAction = renderListing(listing([low]), refused)
    const withoutAction = renderListing(listing([low]))
    const plain = renderListing(listing([card()]), refused)

    expect(withAction).toContain("Az kaldı")
    expect(withAction).toContain('name="variant_id" value="variant_1"')
    expect(withAction).toContain('aria-label="Çakı ürününü sepete ekle"')
    expect(withoutAction).not.toContain('name="variant_id"')
    expect(plain).not.toContain("Az kaldı")
    expect(plain).not.toContain('name="variant_id"')
    // A subcategory's picture beside its name
    expect(withAction).toContain('src="https://cdn.example.com/mutfak.png"')
  })

  it("draws the specs in their sections with their names, and the plain table without", () => {
    const sectioned = renderProduct(
      product({
        specGroups: [
          { title: "Bıçak", rows: [{ label: "Uzunluk", value: "21 cm", highlight: false }] },
          { title: null, rows: [{ label: "Sap ağacı", value: "Ceviz", highlight: false }] },
        ],
      })
    )
    const plain = renderProduct(product())

    expect(sectioned).toMatch(/<th scope="rowgroup"[^>]*>Bıçak<\/th>/)
    expect(sectioned.match(/<tbody>/g)).toHaveLength(2)
    expect(plain.match(/<tbody>/g)).toHaveLength(1)
    expect(plain).not.toContain('scope="rowgroup"')
    expect(plain).toContain("Sap ağacı")
  })

  it("draws the stars' spread and a review's photos", () => {
    const html = renderProduct(
      product({
        reviews: {
          average: 4.5,
          count: 2,
          distribution: [5, 4, 3, 2, 1].map((stars) => ({
            stars: stars as 1 | 2 | 3 | 4 | 5,
            count: stars >= 4 ? 1 : 0,
            percent: stars >= 4 ? 50 : 0,
            label: `${String(stars)} yıldız: ${String(stars >= 4 ? 1 : 0)} değerlendirme`,
          })),
          items: [
            {
              rating: 5,
              title: null,
              body: "Çok iyi.",
              author: "Ayşe Y.",
              date: "4 Kasım 2026",
              verified: true,
              photos: [
                {
                  image: {
                    src: "https://cdn.example.com/yorum-1.jpg",
                    alt: "Ayşe Y. adlı müşterinin fotoğrafı 1",
                    width: 800,
                    height: 600,
                    sources: { avif: null, webp: null },
                  },
                },
              ],
            },
          ],
        },
      })
    )

    expect(html).toContain("5 yıldız: 1 değerlendirme")
    // The bar's width a class, never an inline style (CSP)
    expect(html).not.toMatch(/style="width/)
    expect(html).toContain('src="https://cdn.example.com/yorum-1.jpg"')
    // The review form (its photo field too) opens in a dialog, closed in the server's HTML
  })
})
