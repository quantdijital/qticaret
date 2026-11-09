import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ProductPageView, ThemeActions } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * adr/0055 as the theme prints a product's description: its content
 * document's HTML (the backend's, adr/0019), else its plain text
 * paragraphs.
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

const HTML =
  "<h2>Kullanım</h2><p>Elde <strong>yıkayın</strong>.</p>" +
  "<table><tbody><tr><th>Uzunluk</th><td>21 cm</td></tr></tbody></table>"

const view = (descriptionHtml: string | null): ProductPageView => ({
  id: "prod_1",
  title: "Keten Gömlek",
  subtitle: null,
  description: ["Yıkanmış keten.", "Rahat <kesim>."],
  descriptionHtml,
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
})

const render = (page: ProductPageView) =>
  renderToStaticMarkup(createElement(atolyeTheme.ProductPage, { t, view: page, actions }))

// The description's section: from its heading to the section's end
const descriptionOf = (html: string) => {
  const start = html.indexOf('aria-labelledby="urun-aciklamasi"')
  return start === -1 ? null : html.slice(start, html.indexOf("</section>", start))
}

describe("the theme's product description", () => {
  it("prints the document's HTML as the backend wrote it", () => {
    const section = descriptionOf(render(view(HTML)))
    expect(section).toContain(HTML)
    // Not the plain text paragraphs beside it
    expect(section).not.toContain("Yıkanmış keten.")
  })

  it("falls back to the plain text paragraphs, escaped, without a document", () => {
    const section = descriptionOf(render(view(null)))
    expect(section).toContain("<p>Yıkanmış keten.</p>")
    expect(section).toContain("<p>Rahat &lt;kesim&gt;.</p>")
  })

  it("leaves the section out with neither", () => {
    expect(descriptionOf(render({ ...view(null), description: [] }))).toBeNull()
  })
})
