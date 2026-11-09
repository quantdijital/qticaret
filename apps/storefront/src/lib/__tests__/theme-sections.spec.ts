import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ListingPageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * The theme's sections (adr/0049) as the server prints them: the FAQ
 * open without a script, its answers in the HTML.
 */

const faq: HomeSectionView = {
  id: "sss",
  type: "faq",
  title: null,
  items: [
    { question: "Kargo ne zaman çıkar?", answer: "1–3 iş günü içinde." },
    { question: "İade var mı?", answer: "14 gün içinde <ücretsiz>." },
  ],
}

const listing: ListingPageView = {
  title: "Bıçaklar",
  description: [],
  breadcrumbs: [],
  subcategories: [],
  products: [],
  total: 0,
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: {} },
  sort: [],
  filters: [],
  price: null,
  active: [],
  clearPath: null,
}

describe("the theme's FAQ section", () => {
  it("is native disclosures under a heading, every answer in the HTML, escaped", () => {
    const html = renderToStaticMarkup(
      createElement(atolyeTheme.HomePage, { t, view: { sections: [faq] } })
    )

    expect(html).toContain('<h2 id="bolum-sss"')
    expect(html).toContain("Sık sorulan sorular")
    expect(html.match(/<details/g)).toHaveLength(2)
    expect(html.match(/<summary/g)).toHaveLength(2)
    expect(html).toContain("1–3 iş günü içinde.")
    expect(html).toContain("14 gün içinde &lt;ücretsiz&gt;.")
    expect(html).not.toContain("<script")
  })

  it("takes the shop's own title", () => {
    const html = renderToStaticMarkup(
      createElement(atolyeTheme.HomePage, {
        t,
        view: { sections: [{ ...faq, title: "Merak edilenler" }] },
      })
    )

    expect(html).toContain("Merak edilenler")
    expect(html).not.toContain("Sık sorulan sorular")
  })

  it("goes above a category's grid or below its pages, as placed", () => {
    const html = renderToStaticMarkup(
      createElement(atolyeTheme.ListingPage, {
        t,
        view: {
          ...listing,
          sectionsTop: [{ id: "ust", type: "rich_text", title: "Üstteki", html: "<p>u</p>" }],
          sectionsBottom: [faq],
        },
      })
    )

    const top = html.indexOf("Üstteki")
    const empty = html.indexOf(t("listing.empty"))
    const bottom = html.indexOf("Kargo ne zaman çıkar?")
    expect(top).toBeGreaterThan(html.indexOf("Bıçaklar"))
    expect(top).toBeLessThan(empty)
    expect(bottom).toBeGreaterThan(empty)
  })
})
