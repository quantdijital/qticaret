import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderCatalogView, ShopView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { readFileSync } from "node:fs"
import { aisleFit } from "../../../../../packages/themes/atolye/src/frame/aisle-fit"

const MENU_CSS = readFileSync(
  new URL("../../../../../packages/themes/atolye/src/menu.css", import.meta.url),
  "utf8"
)
/** A rule's body in a stylesheet, by its selector. */
const css = (sheet: string, selector: string) =>
  sheet.slice(sheet.indexOf(`${selector} {`)).split("}")[0] ?? ""

/**
 * The catalog header (adr/0049 Ek 2026-11-14 N14, Ek 2026-11-15) as the
 * server prints it: the strip, the search with the shop's phone, the menu
 * bar on its ground with "Kategoriler", the main menu, the highlighted link
 * and the icons; the phone's rows as the standard header's.
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
    { label: "Bahçe", path: "/kategori/bahce", children: [] },
  ],
  menuGround: "stage",
}

const catalogShop = (set: Partial<HeaderCatalogView> = {}, over: Partial<ShopView> = {}) =>
  shopFixture({
    headerBar: {
      id: "mainheader",
      variant: "catalog",
      sticky: true,
      catalog: { ...CATALOG, ...set },
    },
    ...over,
  })

describe("the catalog header", () => {
  it("draws the strip, the phone under its words and the menu bar on its ground", () => {
    const html = renderFrame(atolyeTheme, catalogShop())
    expect(html).toContain('data-variant="catalog"')
    expect(html).toMatch(/data-gf-strip=""[^>]*class="[^"]*lg:block/)
    expect(html).toContain("Müşteri hizmetleri")
    expect(html).toMatch(/<a href="tel:\+905320000000"[^>]*>(?:(?!<\/a>).)*0532 000 00 00/)
    expect(html).toMatch(/class="gf-menubar[^"]*" data-ground="stage"/)
    // The top links and the phone are not said twice above the header (the bar above stays bare)
    expect(html.match(/href="\/hakkimizda"/g)).toHaveLength(1)
    const standard = renderFrame(atolyeTheme, shopFixture())
    expect(html.match(/href="tel:/g)?.length).toBe(standard.match(/href="tel:/g)?.length)
    // The main menu's panels are in the HTML, folded into the bar
    expect(html).toContain("gf-menubar-aisle")
    expect(html).not.toContain("data-gf-aisle")
  })

  it("lists the top categories under Kategoriler, every link in the first HTML, closed", () => {
    const html = renderFrame(atolyeTheme, catalogShop())
    expect(html).toMatch(/<button type="button" aria-expanded="false" aria-controls="[^"]+"/)
    expect(html).toMatch(/<nav id="[^"]+" aria-label="Tüm kategoriler" hidden=""/)
    expect(html).toContain('href="/kategori/mutfak/sef"')
    expect(html).toContain("Tümünü gör: Mutfak")
    expect(html).toMatch(/data-cm-top="0"[^>]*aria-expanded="false"/)
  })

  it("takes the shop's words, a written search button, the highlighted link and the cart's subtotal", () => {
    const html = renderFrame(
      atolyeTheme,
      catalogShop(
        {
          searchPlaceholder: "Ürün adı ya da kodu",
          searchLabel: true,
          cartTotal: true,
          highlight: { label: "Kampanyalar", path: "/kampanyalar" },
          menuGround: "primary",
        },
        { cart: { lines: [], subtotal: "1.250,00 TL", freeShipping: null } }
      )
    )
    expect(html).toContain('placeholder="Ürün adı ya da kodu"')
    expect(html).toMatch(/<button type="submit" class="gf-btn gf-btn--small[^"]*">Ara<\/button>/)
    expect(html).toMatch(
      /<a href="\/kampanyalar" class="gf-btn gf-btn--small shrink-0">Kampanyalar<\/a>/
    )
    expect(html).toContain('aria-label="Sepet, 2 ürün, 1.250,00 TL"')
    expect(html).toContain('data-ground="primary"')
  })

  it("leaves out what the shop turned off", () => {
    const html = renderFrame(
      atolyeTheme,
      catalogShop({ utilityBar: false, phone: false, categories: [], accountText: false })
    )
    expect(html).not.toContain("data-gf-strip")
    expect(html).not.toContain("Müşteri hizmetleri")
    expect(html).not.toContain("Tüm kategoriler")
    // The bar above the header says the links and the phone again
    expect(html).toMatch(/href="tel:\+905320000000"/)
    const bare = renderFrame(atolyeTheme, catalogShop({ accountText: false }, { topLinks: [] }))
    expect(bare).not.toContain("data-gf-strip")
  })

  it("draws today's header for a catalog bar without its settings", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({ headerBar: { id: "mainheader", variant: "catalog", sticky: true } })
    )
    expect(html).toContain('data-variant="standard"')
    expect(html).toContain('data-gf-aisle=""')
  })

  it("keeps the main menu on one line, a hidden Daha fazla measured beside it", () => {
    const html = renderFrame(atolyeTheme, catalogShop())
    expect(html).toMatch(/<ul[^>]*class="flex flex-nowrap items-center gap-x-1 overflow-x-clip/)
    // Before it is measured every category is drawn; "Daha fazla" waits unseen
    expect(html).toMatch(/data-aisle-more=""[^>]*class="invisible relative"/)
    expect(html).toContain("Daha fazla")
  })

  it("puts the highlighted link right after the main menu, its width kept (Y-05)", () => {
    const html = renderFrame(
      atolyeTheme,
      catalogShop({ highlight: { label: "Kampanyalar", path: "/kampanyalar" } })
    )
    // The highlighted link is the line's last item, its width kept when the line is fitted
    expect(html).toMatch(
      /<li data-aisle-tail=""[^>]*><a href="\/kampanyalar"[^>]*>Kampanyalar<\/a><\/li>/
    )
  })

  it.each(["stage", "primary", "well"] as const)(
    "writes the opened dropdowns in the page's ink on a %s bar",
    (menuGround) => {
      const html = renderFrame(atolyeTheme, catalogShop({ menuGround }))
      // The bar's ground reaches its own items only (`.gf-on-bar`, `.gf-aisle-item`)
      expect(html).toMatch(/data-ground="[^"]+"/)
      expect(html).toContain('class="gf-drop data-[state=closed]:hidden"')
      expect(css(MENU_CSS, ".gf-drop")).toContain("color: var(--color-text)")
      expect(html).toMatch(/aria-label="Tüm kategoriler" hidden=""[^>]*class="[^"]* text-text /)
    }
  )
})

describe("the menu bar's open states (third audit)", () => {
  const child = (n: number) => ({ label: `Alt ${n}`, path: `/kategori/cok/${n}` })

  it("opens each category's narrow dropdown under its own trigger, few children or many (M1)", () => {
    const html = renderFrame(
      atolyeTheme,
      catalogShop(
        {},
        {
          // The main menu's categories: the bar's items and their dropdowns
          categories: [
            { label: "Az", path: "/kategori/az", children: [child(1), child(2)] },
            { label: "Çok", path: "/kategori/cok", children: [1, 2, 3, 4, 5].map(child) },
          ],
        }
      )
    )
    for (const path of ["/kategori/az", "/kategori/cok"]) {
      expect(html).toContain(`data-gf-drop="${path}"`)
    }
    expect(html).toMatch(/href="\/kategori\/cok\/5" class="gf-drop-row"/)
    // No wide panel across the bar any more
    expect(html).not.toMatch(/z-\(--z-dropdown\)[^"]*inset-x-0/)
    expect(html.match(/<li[^>]*data-aisle-item=""[^>]*class="relative"/g)?.length).toBe(2)
  })

  it("draws the open Kategoriler button as the bar's open items, not as the highlighted link", () => {
    const html = renderFrame(atolyeTheme, catalogShop())
    const button = /<button[^>]*aria-expanded="false"[^>]*class="gf-on-bar[^"]*"/.exec(html)?.[0]
    expect(button).toContain("aria-expanded:shadow-[inset_0_-2px_0_currentColor]")
    expect(button).not.toContain("aria-expanded:bg-text")
  })
})

describe("the menu bar's fit", () => {
  it("keeps every item that fits and makes room for Daha fazla otherwise", () => {
    expect(aisleFit([100, 100, 100], 80, 4, 308)).toBe(3)
    expect(aisleFit([100, 100, 100], 80, 4, 300)).toBe(2)
    expect(aisleFit([100, 100, 100], 80, 4, 288)).toBe(2)
    expect(aisleFit([100, 100, 100], 80, 4, 288 - 20)).toBe(1)
    expect(aisleFit([100, 100, 100], 80, 4, 150)).toBe(0)
  })
})
