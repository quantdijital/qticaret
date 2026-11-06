import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { baseTheme } from "@qticaret/theme-base"
import type { ActionResult, ProductPageView, StorefrontTheme, ThemeActions } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The product's short description (adr/0055 Ek 2026-11-06) as both
 * themes print it: as the shop wrote it (the backend's HTML of its
 * document), under the name and the stars, above the price, in place of
 * the headline facts; without one, the facts as before.
 */

const ok = (): Promise<ActionResult> => Promise.resolve({ ok: true, error: null })

const actions: ThemeActions = {
  addToCart: ok,
  changeCartLine: () => Promise.resolve(),
  applyPromotion: ok,
  removePromotion: () => Promise.resolve(),
  writeReview: ok,
  askQuestion: ok,
  stockAlert: () => Promise.resolve({ ok: true, error: null, challenge: null }),
  addFavorite: ok,
  installments: () => Promise.resolve(null),
}

const SUMMARY =
  "<p>El yapımı, <strong>günlük</strong> kullanım için.<br>Kutusuyla gelir.</p>" +
  "<ul><li><p>Sırttan kilitli</p></li><li><p>2 yıl garanti</p></li></ul>"

const view = (over: Partial<ProductPageView> = {}): ProductPageView => ({
  id: "prod_1",
  title: "Yeşil Saplı Çakı",
  subtitle: null,
  description: [],
  descriptionHtml: null,
  brand: null,
  breadcrumbs: [{ label: "Ana sayfa", path: "/" }],
  images: [],
  options: [],
  variants: [
    {
      id: "v_1",
      title: "Yeşil Saplı Çakı",
      options: {},
      price: { current: "1.837,50 TL", before: null, from: false, discount: null },
      available: true,
      sku: null,
    },
  ],
  selectedVariantId: "v_1",
  specs: [{ label: "Namlu çeliği", value: "Elmax", highlight: true }],
  trustBadges: [],
  reviews: { average: 4.5, count: 2, items: [] },
  questions: { count: 0, items: [] },
  related: [],
  whatsappHref: null,
  signedIn: false,
  loginPath: "/hesap/giris",
  shippingNote: null,
  ...over,
})

const THEMES: [string, StorefrontTheme][] = [
  ["atolye", atolyeTheme],
  ["base", baseTheme],
]

describe.each(THEMES)("the %s theme's short description", (_name, theme) => {
  const page = (over: Partial<ProductPageView> = {}) =>
    renderPage(theme, "ProductPage", { view: view(over), actions })

  it("prints it as written, in place of the headline facts, before the price", () => {
    const html = page({ summaryHtml: SUMMARY })
    expect(html).toContain(SUMMARY)
    expect(html).not.toContain("Namlu çeliği: ")
    expect(html.indexOf("Kutusuyla gelir.")).toBeLessThan(html.indexOf("1.837,50 TL"))
    // Never split into the old checked lines
    expect(html).not.toContain('aria-label="Öne çıkan özellikler"><li')
  })

  it("keeps the headline facts without one", () => {
    for (const summaryHtml of [undefined, null]) {
      const html = page(summaryHtml === undefined ? {} : { summaryHtml })
      expect(html).toContain("Namlu çeliği: ")
      expect(html).not.toContain("Kutusuyla")
    }
  })
})

describe("the atolye theme's short description", () => {
  it("sits under the stars in the body's size, always whole, lists as the description's", () => {
    const html = renderPage(atolyeTheme, "ProductPage", {
      view: view({ summaryHtml: SUMMARY.repeat(6) }),
      actions,
    })
    // Never closed behind a "Devamını oku", at any width (sahip 2026-11-06)
    const summary = html.slice(
      html.indexOf('href="#degerlendirmeler"'),
      html.indexOf("1.837,50 TL")
    )
    expect(summary).toContain("Kutusuyla")
    expect(summary).not.toContain("gf-more")
    expect(summary).not.toContain("Devamını oku")
    expect(html.indexOf('href="#degerlendirmeler"')).toBeLessThan(html.indexOf("Kutusuyla"))
    const prose = /<div class="([^"]*)"><p>El yapımı/.exec(html)?.[1] ?? ""
    expect(prose).toContain("text-md")
    expect(prose).toContain("[&amp;_ul]:list-disc")
    // No card: no surface or border of its own
    expect(prose).not.toMatch(/\bbg-|\bborder\b|rounded/)
  })
})
