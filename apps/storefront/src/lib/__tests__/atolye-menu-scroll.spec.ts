import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderCatalogView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { MORE_PANEL } from "../../../../../packages/themes/atolye/src/frame/AisleMore"

const MENU_CSS = readFileSync(
  new URL("../../../../../packages/themes/atolye/src/menu.css", import.meta.url),
  "utf8"
)

/** The last rule of a selector in `menu.css`: the scrolling rules follow the drawing's own. */
const rule = (selector: string) => {
  const at = MENU_CSS.lastIndexOf(`${selector} {`)
  return at === -1 ? "" : (MENU_CSS.slice(at).split("}")[0] ?? "")
}

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

/**
 * The tall menus scroll inside (owner, 2026-11-15: "kategoriler menüsü
 * çok yüksek oluyor, scrollu bir mantık kuralım"; K3a, a fix): a list
 * shorter than the limit is drawn as before, the first HTML unchanged.
 */
describe("the tall menus scroll inside", () => {
  it("stops each panel at 70% of the screen, a thin scrollbar, the page not scrolled on", () => {
    const scroll = rule("[data-cm-sub]")
    expect(MENU_CSS).toMatch(
      /\.gf-drop,\s*\.gf-menu-scroll,\s*\[data-cm-list="top"\],\s*\[data-cm-sub\] \{/
    )
    expect(scroll).toContain("max-height: min(70dvh,")
    expect(scroll).toContain("overflow-y: auto")
    expect(scroll).toContain("overscroll-behavior: contain")
    expect(scroll).toContain("scrollbar-width: thin")
    expect(scroll).toContain("scroll-padding-block")
    // "Daha fazla"'s panel, drawn only once the bar is measured
    expect(MORE_PANEL).toContain("gf-menu-scroll")
  })

  it("scrolls the Kategoriler list, not its box, so a category's panel beside it is not clipped", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        headerBar: { id: "mainheader", variant: "catalog", sticky: true, catalog: CATALOG },
      })
    )
    // The panel's containing block is the box (`absolute`), outside the scrolling list
    expect(html).toMatch(
      /<nav id="[^"]+" aria-label="Tüm kategoriler" hidden="" class="gf-hang absolute /
    )
    expect(html).toMatch(/<ul data-cm-list="top" class="flex flex-col">/)
    expect(html).toMatch(/data-cm-sub="0" hidden="" class="absolute top-0 left-full/)
    expect(rule('[data-cm-list="top"]')).toContain("margin: calc(-1 * var(--space-xs))")
  })

  it("keeps a dropdown's Tümünü gör at its foot on its own ground, in every menu style", () => {
    const all = rule(".gf-drop-all")
    expect(all).toContain("position: sticky")
    expect(all).toContain("background-color: var(--color-field)")
    expect(rule('[data-menu-style="plain"]) .gf-drop-all:hover:not(:active)')).toContain(
      "background-color: var(--color-field)"
    )
  })
})

/**
 * The menu bar's panels hang alike (owner, 2026-11-16: "kategorileri hover
 * olup açılan dropdown headere yapışık geliyor diğer menü linklerinde öyle
 * değil"; a fix): the "Kategoriler" list hung 4 px under its 44 px button,
 * which ends 4 px above the 52 px bar's edge, so it touched the bar; a
 * category's dropdown hangs 8 px under its item. "Daha fazla"'s panel hung
 * right under its button, inside the bar. All three now take one rule.
 */
describe("the menu bar's panels hang alike", () => {
  it("hangs the Kategoriler list one step under its button, as a category's dropdown", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        headerBar: { id: "mainheader", variant: "catalog", sticky: true, catalog: CATALOG },
      })
    )
    const list = /aria-label="Tüm kategoriler" hidden="" class="([^"]+)"/.exec(html)?.[1] ?? ""

    expect(list.split(" ")).toContain("gf-hang")
    // No offset of its own: the shared rule places it
    expect(list).not.toMatch(/(^| )-?(top|mt)-/)
    expect(MENU_CSS).toMatch(
      /\.gf-drop,\s*\.gf-hang \{\s*top: calc\(100% \+ var\(--space-xs\)\);\s*\}/
    )
    // One place sets the step: the dropdown's own rule leaves it out
    expect(rule(".gf-drop")).not.toContain("top:")
    expect(MENU_CSS.match(/top: calc\(100% \+ var\(--space-xs\)\)/g)).toHaveLength(1)
  })

  it("hangs the Daha fazla panel by the same rule", () => {
    // Drawn only once the bar is measured: its class is the whole of its placement
    expect(MORE_PANEL.split(" ")).toContain("gf-hang")
    expect(MORE_PANEL).not.toMatch(/(^| )-?(top|mt)-/)
  })
})
