import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ListingPageView, StockFilterView } from "@qticaret/ui"
import { t } from "@/lib/i18n"

/**
 * The theme's in-stock toggle (adr/0056) as the server prints it: a
 * plain link with its count among the filters, on phones and wide screens
 * alike; nothing when the listing does not offer it.
 */

const LABEL = "Yalnızca stokta olanlar"

const listing: ListingPageView = {
  title: "Bıçaklar",
  description: [],
  breadcrumbs: [],
  subcategories: [],
  products: [],
  total: 9,
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: {} },
  sort: [],
  filters: [],
  price: null,
  active: [],
  clearPath: null,
}

const render = (view: ListingPageView) =>
  renderToStaticMarkup(createElement(atolyeTheme.ListingPage, { t, view }))

/** The toggle's links: one in the wide aside, one in the phone's folded panel. */
const toggles = (html: string) =>
  [...html.matchAll(/<a [^>]*>(?:(?!<\/a>).)*Yalnızca stokta olanlar(?:(?!<\/a>).)*<\/a>/g)].map(
    (match) => match[0]
  )

const stock = (over: Partial<StockFilterView> = {}): StockFilterView => ({
  label: LABEL,
  count: 7,
  selected: false,
  path: "/kategori/caki?stok=var",
  ...over,
})

describe("the theme's in-stock toggle", () => {
  it("is a nofollow link with its count, in both filter panels, without a script", () => {
    const html = render({ ...listing, stock: stock() })
    const links = toggles(html)
    expect(links).toHaveLength(2)
    for (const link of links) {
      // The path as the storefront built it, the phone's panel adding its anchor
      expect(link).toMatch(/href="\/kategori\/caki\?stok=var(#[a-z-]+)?"/)
      expect(link).toContain('rel="nofollow"')
      expect(link).toContain(">7</span>")
      expect(link).not.toContain("aria-current")
    }
    // The toggle alone opens the filter panel
    expect(html).toContain('aria-labelledby="filtre-baslik"')
    expect(html).not.toContain("<script")
  })

  it("says it is on, its link taking it away", () => {
    const html = render({
      ...listing,
      stock: stock({ selected: true, count: 5, path: "/kategori/caki" }),
      active: [{ label: LABEL, path: "/kategori/caki" }],
      clearPath: "/kategori/caki",
    })
    const [link] = toggles(html)
    expect(link).toContain('aria-current="true"')
    expect(link).toContain('href="/kategori/caki"')
    expect(link).toContain(">5</span>")
    // Its chip among what is chosen
    expect(html).toContain(`aria-label="${t("listing.remove_filter", { label: LABEL })}"`)
  })

  it("is absent when the listing does not offer it", () => {
    for (const view of [listing, { ...listing, stock: null }]) {
      const html = render(view)
      expect(html).not.toContain(LABEL)
      expect(html).not.toContain('aria-labelledby="filtre-baslik"')
    }
  })
})
