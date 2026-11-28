import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { ListingPageView, ProductCardView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * A listing page's layout (`listing_page`): the products one to a row,
 * the shopper's grid/list switch beside the sort, a dated shop's month
 * filter; and the filter column's first well level with the first card.
 */

const card = (id: string, over: Partial<ProductCardView> = {}): ProductCardView => ({
  id,
  title: `Tur ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: {
    src: `/media/${id}.jpg`,
    alt: id,
    width: 800,
    height: 600,
    sources: { avif: null, webp: null },
  },
  price: { current: "1.750,00 TL", before: null, from: false, discount: null },
  available: true,
  ...over,
})

const view = (over: Partial<ListingPageView> = {}): ListingPageView => ({
  title: "Tüm ürünler",
  description: [],
  breadcrumbs: [{ label: "Ana sayfa", path: "/" }],
  subcategories: [],
  products: [
    card("a", {
      booking: { next: "12 Ara", nextAt: "2026-12-12T06:00:00Z", duration: "5 gün • 4 gece" },
      look: {
        over: false,
        ratingBadge: false,
        arrow: false,
        duration: true,
        perPerson: true,
      },
      badge: { text: "Çok satan", kind: "best_seller" },
    }),
    card("b"),
  ],
  total: 8,
  pagination: { page: 1, pages: 1, previous: null, next: null, pagePath: { 1: "/magaza" } },
  sort: [
    { label: "Önerilen", path: "/magaza", current: true },
    { label: "En yeniler", path: "/magaza?sirala=yeni", current: false },
  ],
  filters: [
    {
      key: "gidilecek_yer",
      label: "Gidilecek yer",
      options: [{ label: "Kapadokya", count: 3, selected: false, path: "/magaza?gidilecek_yer=k" }],
    },
  ],
  price: null,
  active: [],
  clearPath: null,
  ...over,
})

const page = (over: Partial<ListingPageView> = {}) =>
  renderPage(atolyeTheme, "ListingPage", { view: view(over) })

const SWITCH: NonNullable<ListingPageView["viewSwitch"]> = {
  label: "Görünüm",
  action: "/magaza",
  name: "gorunum",
  options: [
    { mode: "grid", value: "izgara", label: "Izgara görünümü", current: false },
    { mode: "list", value: "liste", label: "Liste görünümü", current: true },
  ],
  keep: [{ name: "sirala", value: "yeni" }],
}

describe("the listing's trail (listing_page.crumbs_place)", () => {
  const TRAIL = '<nav aria-label="Bulunduğunuz yer">'

  it("draws the trail above the title by default and beside it on request", () => {
    expect(page()).toContain(TRAIL)
    expect(page({ crumbsPlace: "above" })).toBe(page())
    expect(page({ crumbsPlace: "beside" })).toContain(TRAIL)
  })

  it("draws no trail when turned off, the title then first", () => {
    const html = page({ crumbsPlace: "none" })
    expect(html).not.toContain(TRAIL)
    expect(html).toContain('<header class="flex flex-col gap-3"><h1>Tüm ürünler</h1>')
  })
})

describe("the listing's layout", () => {
  it("draws today's grid and no switch without the setting", () => {
    const html = page()
    expect(html).toContain("md:grid-cols-[repeat(3,minmax(0,1fr))]")
    expect(html).not.toContain('name="gorunum"')
    expect(html).not.toContain("İncele")
  })

  it("draws one product to a row: the photo, the words, the price and İncele", () => {
    const html = page({ layout: "list" })
    expect(html).not.toContain("md:grid-cols-[repeat(3,minmax(0,1fr))]")
    expect(html).toContain("lg:grid-cols-[18rem_minmax(0,1fr)_minmax(10rem,auto)]")
    // A phone keeps the photo small on the left: never a sideways scroll
    expect(html).toContain("grid-cols-[7rem_minmax(0,1fr)]")
    expect(html).toContain("5 gün • 4 gece")
    expect(html).toContain('dateTime="2026-12-12T06:00:00Z"')
    expect(html).toContain("Çok satan")
    expect(html).toContain("İncele")
    expect(html).toContain('href="/urun/b"')
  })

  it("puts the switch beside the sort: a GET form, the page's parameters kept, the one on pressed", () => {
    const html = page({ layout: "list", viewSwitch: SWITCH })
    expect(html).toMatch(
      /<form role="group" aria-label="Görünüm"[^>]*action="\/magaza" method="get"/
    )
    expect(html).toContain('<input type="hidden" name="sirala" value="yeni"/>')
    expect(html).toMatch(
      /value="izgara" aria-pressed="false" aria-label="Izgara görünümü"[^>]*name="gorunum"/
    )
    expect(html).toMatch(
      /value="liste" aria-pressed="true" aria-label="Liste görünümü"[^>]*name="gorunum"/
    )
  })

  it("offers a dated shop's months as a filter well, one chosen", () => {
    const html = page({
      dates: {
        label: "Kalkış tarihi",
        options: [
          { label: "Kasım 2026", path: "/magaza?ay=2026-11", selected: false },
          { label: "Aralık 2026", path: "/magaza", selected: true },
        ],
      },
    })
    expect(html).toContain("Kalkış tarihi")
    expect(html).toContain('href="/magaza?ay=2026-11" rel="nofollow"')
    expect(html).toContain('href="/magaza?ay=2026-11#filtreler"')
    expect(html).toMatch(/href="\/magaza" rel="nofollow" aria-current="true"/)
  })

  it("starts the first filter well level with the first card, the same gap under each head", () => {
    const html = page()
    // The filter column's head and the count row are as tall as the sort pill, 24 px above each
    expect(html).toContain('class="flex min-h-11 items-center text-title"')
    expect(html).toContain("lg:flex lg:min-h-11 lg:items-center lg:justify-between")
    expect(html).toMatch(/overflow-y-auto[^"]*"|flex-col gap-6 overflow-y-auto/)
    expect(html).toContain('class="flex min-w-0 flex-col gap-6"')
  })
})
