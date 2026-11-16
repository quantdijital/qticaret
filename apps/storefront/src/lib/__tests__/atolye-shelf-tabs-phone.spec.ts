import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ProductCardView } from "@qticaret/ui"
import { ATOLYE_SOURCE, atolyeCss } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The tabbed shelf on a phone and a tablet (owner 2026-11-16). First "piller
 * sonra link sonra ürünler saçma ve karmaşık": the panel's "all products" link
 * stood alone on a row between the pills and the cards. Then, of the scrolling
 * pill row with the link at its end: "pilin birisi lap diye kesik görünüyor,
 * hoş değil"; the pills wrapped for a while. Last: "piller sağa kaydırılabilir
 * olsun, alt satıra düşmesin. Tüm ürünler düğmesinin altta olması güzel."
 * Below 1024 px the pills stay on one line that scrolls to the screen's
 * edges, a cut edge fading while more waits past it, and the link stands
 * under the cards as a full-width quiet button. The desktop is as it was.
 */

const TABS = atolyeCss("tabs.css")
const RAIL = atolyeCss("tabs-rail.css")

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
  it("keeps the pills on one line that scrolls past the container to the screen's edges", () => {
    expect(html).toContain('<fieldset class="gf-tab-row min-w-0 border-0 p-0">')
    expect(html).toContain('<legend class="sr-only">')
    expect(html.match(/<input type="radio" name="[^"]+-raf"/g)).toHaveLength(3)
    const pills = /<legend class="sr-only">[^<]*<\/legend><div class="([^"]*)"/.exec(html)?.[1]
    const classes = (pills ?? "").split(" ")
    // At every width: one line, the first pill on the page's left line and
    // the last able to scroll fully into view (the gutter's padding at both ends)
    expect(classes).toEqual(
      expect.arrayContaining([
        "gf-rail",
        "flex",
        "gap-(--space-xs)",
        "overflow-x-auto",
        "-mx-(--gutter)",
        "px-(--gutter)",
        "scroll-px-(--gutter)",
      ])
    )
    expect(classes).not.toContain("flex-wrap")
    expect(classes.filter((name) => name.startsWith("lg:"))).toEqual([])
    expect(TABS).toMatch(/\.gf-tab \{[^}]*white-space: nowrap;/)
  })

  it("fades a cut edge below 1024 px only while more waits past it", () => {
    expect(RAIL).not.toContain("@media (width >= 64rem)")
    const below = block(RAIL, "@media (width < 64rem)")
    // A loose snap to a pill's start (the bar hidden and the overscroll held by `.gf-rail`)
    expect(below).toMatch(/\.gf-tab-row > \.gf-rail \{\s*scroll-snap-type: x proximity;\s*\}/)
    // The fades follow the row's own scrolling: an inactive timeline (every
    // pill in view) or a browser without one draws none
    const fades = block(below, "@supports (animation-timeline: scroll())")
    expect(fades).toMatch(
      /mask-image: linear-gradient\(\s*to right,\s*transparent,\s*#000 var\(--gf-tab-fade-start\),\s*#000 calc\(100% - var\(--gf-tab-fade-end\)\),\s*transparent\s*\);/
    )
    expect(fades).toContain("animation-timeline: scroll(self inline);")
    for (const name of ["--gf-tab-fade-start", "--gf-tab-fade-end"]) {
      expect(block(RAIL, `@property ${name}`)).toContain("initial-value: 0px;")
    }
    // The start fades over the gutter (a pill snapped to the left line stands
    // clear of it), the end over 2rem
    expect(block(RAIL, "@keyframes gf-tab-fade-start")).toContain(
      "--gf-tab-fade-start: var(--gutter);"
    )
    expect(block(RAIL, "@keyframes gf-tab-fade-end")).toMatch(/from \{\s*--gf-tab-fade-end: 2rem;/)
    // Nothing moves by itself: no animation runs on a clock
    expect(RAIL).not.toMatch(/animation:[^;]*\d+m?s\b/)
  })

  it("brings a pill reached by the keys or chosen into view whole, clear of the fade", () => {
    const below = block(RAIL, "@media (width < 64rem)")
    expect(below).toMatch(
      /\.gf-tab-row > \.gf-rail > \.gf-tab > input \{\s*position: absolute;\s*inset: 0;\s*width: 100%;\s*height: 100%;[^}]*scroll-margin-inline: 1rem;/
    )
    const follow = readFileSync(`${ATOLYE_SOURCE}sections/ShelfTabsFollow.tsx`, "utf8")
    expect(follow).toContain('const NARROW = "(width < 64rem)"')
    expect(follow).toContain('inline: "nearest"')
    expect(follow).toMatch(/matchMedia\(REDUCED\)\.matches \? "auto" : "smooth"/)
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
