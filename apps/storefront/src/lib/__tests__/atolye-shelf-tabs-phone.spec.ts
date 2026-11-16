import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ProductCardView } from "@qticaret/ui"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The tabbed shelf on a phone and a tablet (owner 2026-11-16). First "piller
 * sonra link sonra ürünler saçma ve karmaşık": the panel's "all products" link
 * stood alone on a row between the pills and the cards. Then, of the scrolling
 * pill row with the link at its end: "pilin birisi lap diye kesik görünüyor,
 * hoş değil". Below 1024 px the pills wrap, none cut, and the link stands
 * under the cards as a full-width quiet button. The desktop's rules are as
 * they were.
 */

const TABS = atolyeCss("tabs.css")

const product = (id: string): ProductCardView => ({
  id,
  title: `Ürün ${id}`,
  path: `/urun/${id}`,
  brand: null,
  image: null,
  price: { current: "1.299,90 TL", before: null, from: false, discount: null },
  available: true,
})

const shelf = (id: string, title: string): HomeSectionView => ({
  id,
  type: "products",
  title,
  products: [product(`${id}-1`), product(`${id}-2`)],
  more: { label: "Tüm ürünler", path: "/magaza" },
  empty: "Henüz yayında ürün yok.",
})

const html = renderPage(atolyeTheme, "HomePage", {
  view: {
    sections: [
      shelf("coksatanlar", "Çok satanlar"),
      shelf("yenigelenler", "Yeni gelenler"),
      shelf("kilic", "Kılıç Modelleri"),
    ],
  },
})

const carousel = renderPage(atolyeTheme, "HomePage", {
  view: {
    sections: [
      { ...shelf("yeni", "Yeni gelenler"), variant: "carousel" },
      { ...shelf("av", "Av bıçakları"), variant: "carousel" },
    ] as HomeSectionView[],
  },
})

/** A block of the stylesheet from its opening line to the brace that closes it. */
function block(css: string, opening: string): string {
  const start = css.indexOf(opening)
  if (start < 0) {
    throw new Error(`no ${opening}`)
  }
  let depth = 0
  for (let at = css.indexOf("{", start); at < css.length; at += 1) {
    if (css[at] === "{") depth += 1
    if (css[at] === "}") depth -= 1
    if (depth === 0) {
      return css.slice(start, at + 1)
    }
  }
  throw new Error(`${opening} is not closed`)
}

describe("the tabbed shelf on a phone and a tablet", () => {
  it("wraps the pills below 1024 px and keeps one scrolling rail from 1024 px", () => {
    expect(html).toContain('<fieldset class="gf-tab-row min-w-0 border-0 p-0">')
    expect(html).toContain('<legend class="sr-only">')
    expect(html.match(/<input type="radio" name="[^"]+-raf"/g)).toHaveLength(3)
    const pills = /<legend class="sr-only">[^<]*<\/legend><div class="([^"]*)"/.exec(html)?.[1]
    const classes = (pills ?? "").split(" ")
    // Below 1024 px: lines of pills, none cut, the row inside the page's gutter
    expect(classes).toEqual(expect.arrayContaining(["flex", "flex-wrap", "gap-(--space-xs)"]))
    expect(classes.filter((name) => !name.startsWith("lg:"))).not.toContain("overflow-x-auto")
    expect(classes.filter((name) => !name.startsWith("lg:"))).not.toContain("-mx-(--gutter)")
    // From 1024 px: the rail as before, past the container by the gutter
    expect(classes).toEqual(
      expect.arrayContaining([
        "gf-rail",
        "lg:flex-nowrap",
        "lg:overflow-x-auto",
        "lg:-mx-(--gutter)",
        "lg:px-(--gutter)",
        "lg:scroll-px-(--gutter)",
      ])
    )
    expect(TABS).toMatch(/\.gf-tab \{[^}]*white-space: nowrap;/)
  })

  it("puts a plain panel's link after its cards, its title for a reader before them", () => {
    const panel = html.slice(html.indexOf('data-panel="0"'), html.indexOf('data-panel="1"'))
    const title = panel.indexOf('class="sr-only">Çok satanlar</h2>')
    const cards = panel.indexOf('href="/urun/coksatanlar-1"')
    const link = panel.indexOf(
      '<div class="gf-tab-aside flex min-h-11 items-center justify-end gap-4"><a href="/magaza" class="gf-link'
    )
    expect(title).toBeGreaterThan(-1)
    expect(cards).toBeGreaterThan(title)
    expect(link).toBeGreaterThan(cards)
    expect(html.match(/class="gf-tab-aside /g)).toHaveLength(3)
  })

  it("keeps a carousel's link in its head row with the arrows", () => {
    expect(carousel).toMatch(
      /class="gf-scroller-head[^"]*"><div class="min-w-0 flex-1"><div class="gf-tab-aside[^"]*"><h2 id="[^"]+" class="sr-only">Yeni gelenler<\/h2><a href="\/magaza" class="gf-link/
    )
  })

  it("draws the link under the cards below 1024 px as a full-width quiet button", () => {
    const below = block(TABS, "@media (width < 64rem)")
    expect(below).toMatch(
      /\.gf-tabs > \[data-panel\] \.gf-tab-aside > a \{\s*flex: 1 1 auto;\s*min-height: 3rem;\s*justify-content: center;[^}]*border: 1px solid var\(--color-edge\);\s*border-radius: var\(--button-radius\);\s*background: transparent;[^}]*text-decoration: none;/
    )
    // A carousel's head row (its link, its arrows) moves under its cards
    expect(below).toMatch(
      /\.gf-tabs > \[data-panel\] \.gf-scroller-head:has\(\.gf-tab-aside > a\) \{\s*order: 1;/
    )
    // Nothing lifts the link onto the tab row, nor reserves room at the row's end
    expect(below).not.toContain("position: absolute")
    expect(below).not.toContain("padding-inline-end")
  })

  it("leaves the desktop as it was", () => {
    expect(block(TABS, "@media (width >= 64rem)")).toBe(`@media (width >= 64rem) {
  @supports selector(:has(*)) {
    .gf-tabs {
      position: relative;
    }
    .gf-tabs > [data-panel] :is(.gf-scroller-head, section > .gf-tab-aside) {
      position: absolute;
      top: 0.25rem;
      right: 0;
      max-width: 40%;
      align-items: center;
    }
    .gf-tabs > .gf-tab-row {
      padding-inline-end: min(22rem, 40%);
    }
  }
}`)
    expect(TABS).not.toContain("@media (width < 40rem)")
  })
})
