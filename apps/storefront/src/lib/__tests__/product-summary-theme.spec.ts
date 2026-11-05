import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { baseTheme } from "@qticaret/theme-base"
import type { ActionResult, ProductPageView, StorefrontTheme, ThemeActions } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The product's short description (adr/0055 Ek 2026-11-05) as both
 * themes print it: up to five plain lines in a list under the name and
 * the stars, above the price, in place of the headline facts; without
 * one, the facts as before.
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

const SUMMARY = ["N690 çelik, 58-59 HRC", "Geyik boynuzu sap", "Sırttan kilitli", "2 yıl <garanti>"]

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

// The list the page labels as its short description
const summaryOf = (html: string) =>
  /<ul aria-label="Öne çıkan özellikler"[^>]*>[\s\S]*?<\/ul>/.exec(html)?.[0] ?? null

describe.each(THEMES)("the %s theme's short description", (_name, theme) => {
  const page = (over: Partial<ProductPageView> = {}) =>
    renderPage(theme, "ProductPage", { view: view(over), actions })

  it("lists its lines as text, in place of the headline facts, before the price", () => {
    const html = page({ summary: SUMMARY })
    const list = summaryOf(html) ?? ""
    expect(list.match(/<li/g)).toHaveLength(4)
    expect(list).toContain("N690 çelik, 58-59 HRC")
    // Plain text, never markup
    expect(list).toContain("2 yıl &lt;garanti&gt;")
    expect(html).not.toContain("Namlu çeliği: ")
    expect(html.indexOf("Sırttan kilitli")).toBeLessThan(html.indexOf("1.837,50 TL"))
  })

  it("keeps the headline facts without one", () => {
    for (const summary of [undefined, []]) {
      const html = page(summary ? { summary } : {})
      expect(html).toContain("Namlu çeliği: ")
      expect(html).not.toContain("N690")
    }
  })
})

describe("the atolye theme's short description", () => {
  it("checks each line with a quiet icon under the stars", () => {
    const html = renderPage(atolyeTheme, "ProductPage", {
      view: view({ summary: SUMMARY }),
      actions,
    })
    const list = summaryOf(html) ?? ""
    expect(list.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(4)
    expect(list).toContain("text-text-2")
    expect(html.indexOf('href="#degerlendirmeler"')).toBeLessThan(html.indexOf(list))
  })
})
