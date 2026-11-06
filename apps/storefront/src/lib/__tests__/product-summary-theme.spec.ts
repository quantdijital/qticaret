import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { baseTheme } from "@qticaret/theme-base"
import type { ActionResult, ProductPageView, StorefrontTheme, ThemeActions } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The product's short description (adr/0055 Ek 2026-11-06) as both
 * themes print it: as the shop wrote it (the backend's HTML of its
 * document), in place of the headline facts; without one, the facts as
 * before. Base keeps it above the price; Atölye sets it under the price
 * group (price, saving, instalments) and above the choices (sahip
 * 2026-11-06: the price block "kısa açıklamanın üstünde olsun").
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

const VARIANT: ProductPageView["variants"][number] = {
  id: "v_1",
  title: "Yeşil Saplı Çakı",
  options: {},
  price: { current: "1.837,50 TL", before: null, from: false, discount: null },
  available: true,
  sku: null,
}

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
  variants: [VARIANT],
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

  it("prints it as written, in place of the headline facts", () => {
    const html = page({ summaryHtml: SUMMARY })
    expect(html).toContain(SUMMARY)
    expect(html).not.toContain("Namlu çeliği: ")
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

describe("the base theme's short description", () => {
  it("sits above the price", () => {
    const html = renderPage(baseTheme, "ProductPage", {
      view: view({ summaryHtml: SUMMARY }),
      actions,
    })
    expect(html.indexOf("Kutusuyla gelir.")).toBeLessThan(html.indexOf("1.837,50 TL"))
  })
})

describe("the atolye theme's short description", () => {
  it("sits under the price group, above the choices, in the body's size, always whole", () => {
    const html = renderPage(atolyeTheme, "ProductPage", {
      view: view({
        summaryHtml: SUMMARY.repeat(6),
        variants: [
          {
            ...VARIANT,
            installments: { count: 12, perInstallment: "195,87 TL" },
          },
        ],
      }),
      actions,
    })
    // Price, instalments, then the short description, then the buy form and its row
    const at = (text: string) => html.indexOf(text)
    expect(at('href="#degerlendirmeler"')).toBeLessThan(at("1.837,50 TL"))
    expect(at("1.837,50 TL")).toBeLessThan(at("12 aya varan taksit"))
    expect(at("12 aya varan taksit")).toBeLessThan(at("Kutusuyla"))
    expect(at("Kutusuyla")).toBeLessThan(at('id="sepet-formu"'))
    expect(at("Kutusuyla")).toBeLessThan(at("data-buy-row"))
    // Never closed behind a "Devamını oku", at any width (sahip 2026-11-06)
    const summary = html.slice(at("12 aya varan taksit"), at('id="sepet-formu"'))
    expect(summary).toContain("Kutusuyla")
    expect(summary).not.toContain("gf-more")
    expect(summary).not.toContain("Devamını oku")
    const prose = /<div class="([^"]*)"><p>El yapımı/.exec(html)?.[1] ?? ""
    expect(prose).toContain("text-md")
    expect(prose).toContain("[&amp;_ul]:list-disc")
    // No card: no surface or border of its own
    expect(prose).not.toMatch(/\bbg-|\bborder\b|rounded/)
  })
})
