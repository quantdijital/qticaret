import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderCatalogView, ShopView } from "@qticaret/ui"
import { catalogStrip, renderFrame, shopOf } from "@/test/theme-render"
import { barFit } from "../../../../../packages/themes/atolye/src/frame/aisle-fit"

/**
 * The catalog header's layout choices (adr/0049 Ek 2026-11-15, adr/0066
 * §2): where its tools and the shop's top links stand and how wide its
 * search is, each default today's drawing.
 */

const CATALOG: HeaderCatalogView = {
  searchPlaceholder: null,
  searchLabel: false,
  accountText: true,
  cartTotal: false,
  highlight: null,
  utilityBar: true,
  phone: true,
  categories: [
    {
      label: "Mutfak",
      path: "/kategori/mutfak",
      children: [{ label: "Şef bıçakları", path: "/kategori/mutfak/sef" }],
    },
  ],
  menuGround: "stage",
}

// The catalog header with the top strip its settings read into (owner 2026-11-27)
const catalogShop = (set: Partial<HeaderCatalogView> = {}, over: Partial<ShopView> = {}) =>
  shopOf({
    headerBar: {
      id: "mainheader",
      variant: "catalog",
      sticky: true,
      catalog: { ...CATALOG, ...set },
    },
    ...catalogStrip({ ...CATALOG, ...set }),
    ...over,
  })

/** The header element alone (the bar above it and the footer aside). */
const headerOf = (html: string) => /<header[\s\S]*?<\/header>/.exec(html)?.[0] ?? ""
/** The menu bar's part of the header. */
const barOf = (html: string) => headerOf(html).slice(headerOf(html).indexOf('class="gf-menubar'))

describe("the catalog header's layout choices", () => {
  it("draws today's header when each choice is its default or absent (an older answer)", () => {
    const absent = renderFrame(atolyeTheme, catalogShop())
    const defaults = renderFrame(
      atolyeTheme,
      catalogShop({ toolsPlace: "bar", topLinksPlace: "strip", searchWidth: "wide" })
    )
    expect(defaults).toBe(absent)
    expect(barOf(absent)).toContain('href="/hesap" aria-label="Hesabım" class="gf-on-bar')
    expect(absent).toMatch(/data-gf-strip=""/)
    expect(absent).not.toContain("data-bar-links")
    expect(absent).not.toContain("max-w-140")
  })

  it("puts account, favourites and the cart named in the top row, the account once", () => {
    const html = headerOf(
      renderFrame(
        atolyeTheme,
        catalogShop(
          { toolsPlace: "row", cartTotal: true },
          { cart: { lines: [], subtotal: "1.250,00 TL", freeShipping: null } }
        )
      )
    )
    // None on the menu bar, one cart link, the account written once (the strip says no "Hesabım")
    expect(barOf(html)).not.toContain('href="/hesap')
    expect(barOf(html)).not.toContain('href="/sepet"')
    expect(html.match(/href="\/sepet"/g)).toHaveLength(1)
    expect(html.match(/href="\/hesap"/g)).toHaveLength(1)
    expect(html).toMatch(/href="\/hesap" aria-label="Hesabım" class="gf-icon-btn gf-tool flex-col/)
    expect(html).toMatch(/<span aria-hidden="true" class="max-lg:hidden">Favoriler<\/span>/)
    // The cart's subtotal in place of "Sepet", its full name said
    expect(html).toContain('aria-label="Sepet, 2 ürün, 1.250,00 TL"')
    // After the phone; without a phone it takes the row's end itself
    expect(html.indexOf("Müşteri hizmetleri")).toBeLessThan(html.indexOf('href="/hesap"'))
    const alone = headerOf(
      renderFrame(atolyeTheme, catalogShop({ toolsPlace: "row", phone: false }))
    )
    expect(alone).toMatch(
      /<nav aria-label="Hesabım" class="flex shrink-0 items-center lg:gap-1 lg:ml-auto"/
    )
    // The strip still carries the top links, its "Hesabım" gone
    expect(html).toMatch(/data-gf-strip=""/)
    expect(html).not.toMatch(/data-gf-strip=""(?:(?!<\/div>).)*href="\/hesap"/)
  })

  it("draws no strip when the tools stand in the row and the top links at the bar's end", () => {
    const html = renderFrame(atolyeTheme, catalogShop({ toolsPlace: "row", topLinksPlace: "bar" }))
    expect(html).not.toContain("data-gf-strip")
  })

  it("puts the shop's top links quietly at the menu bar's end, said once, whatever the strip", () => {
    for (const utilityBar of [true, false]) {
      const html = renderFrame(atolyeTheme, catalogShop({ topLinksPlace: "bar", utilityBar }))
      const bar = barOf(html)
      expect(bar).toMatch(
        /<nav aria-label="Kurumsal bağlantılar" data-bar-links="" class="shrink-0 items-center flex"/
      )
      expect(bar).toMatch(/<a href="\/hakkimizda" class="gf-menu-item gf-menu-item--bar[^"]*"/)
      // Not in the strip, not in the bar above the header
      expect(html.match(/href="\/hakkimizda"/g)).toHaveLength(1)
    }
    // The strip keeps "Hesabım" beside the bar's icons
    const strip = renderFrame(atolyeTheme, catalogShop({ topLinksPlace: "bar" }))
    expect(strip).toMatch(/data-gf-strip=""/)
    // Without categories the links stand at the bar's end, the icons after them
    const bare = barOf(
      renderFrame(atolyeTheme, catalogShop({ topLinksPlace: "bar" }, { categories: [] }))
    )
    expect(bare).toContain('data-bar-links="" class="shrink-0 items-center flex ml-auto"')
    expect(bare).toMatch(/<nav aria-label="Hesabım" class="flex shrink-0 items-center gap-1 ml-0"/)
  })

  it("leaves the top links to the bar above when they stand in a strip the shop turned off", () => {
    const html = renderFrame(atolyeTheme, catalogShop({ utilityBar: false }))
    expect(headerOf(html)).not.toContain('href="/hakkimizda"')
    expect(html).toContain('href="/hakkimizda"')
  })

  it("narrows the search to 35 rem right after the wordmark", () => {
    const html = headerOf(renderFrame(atolyeTheme, catalogShop({ searchWidth: "narrow" })))
    expect(html).toMatch(/class="[^"]*lg:\[&amp;&gt;\[role=search\]\]:max-w-140/)
  })
})

describe("the menu bar's fit with the shop's links", () => {
  const sizes = { widths: [100, 100, 100], more: 80, gap: 4, tail: 0, links: 150, between: 8 }

  it("keeps the links at the end while every category fits beside them", () => {
    expect(barFit(sizes, 308 + 158)).toEqual({ count: 3, links: true })
  })

  it("sends the links under Daha fazla, shown, once the categories need the room", () => {
    // Every category fits without the links: Daha fazla still shows, for the links
    expect(barFit(sizes, 400)).toEqual({ count: 3, links: false })
    expect(barFit(sizes, 308)).toEqual({ count: 2, links: false })
  })

  it("decides as before without links", () => {
    expect(barFit({ ...sizes, links: 0 }, 308)).toEqual({ count: 3, links: false })
    expect(barFit({ ...sizes, links: 0 }, 300)).toEqual({ count: 2, links: false })
  })
})
