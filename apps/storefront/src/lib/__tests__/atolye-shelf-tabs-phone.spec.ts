import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ProductCardView } from "@qticaret/ui"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The tabbed shelf on a phone (owner 2026-11-16: "tüm ürünler alt satırda
 * kalıyor o yüzden piller sonra link sonra ürünler saçma ve karmaşık
 * görünüyor"): the panel's "all products" link stood alone on a row under
 * the pills. Below 640 px it stands at the tab row's right end, as on a
 * wide screen and as a section head's link does; the pills scroll beside
 * it. The markup is the same; the tablet's and the desktop's rules too.
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

describe("the tabbed shelf on a phone", () => {
  it("keeps its markup: radio pills in a named group, in a rail that scrolls sideways, each panel's link in its aside", () => {
    expect(html).toContain('<fieldset class="gf-tab-row min-w-0 border-0 p-0">')
    expect(html).toContain('<legend class="sr-only">')
    expect(html.match(/<input type="radio" name="[^"]+-raf"/g)).toHaveLength(3)
    // One line of pills that scrolls, its bar hidden (`gf-rail`), never wrapping
    expect(html).toMatch(/class="gf-rail [^"]*flex [^"]*overflow-x-auto[^"]*"/)
    expect(html).not.toMatch(/gf-tab-row[^>]*flex-wrap/)
    expect(TABS).toMatch(/\.gf-tab \{[^}]*white-space: nowrap;/)
    // Each panel's head: its title for a reader, its link, as before
    expect(
      html.match(/class="gf-tab-aside flex min-h-11 items-center justify-end gap-4"/g)
    ).toHaveLength(3)
    expect(html).toMatch(/class="sr-only">Çok satanlar<\/h2><a href="\/magaza" class="gf-link/)
  })

  it("lifts a plain panel's link onto the tab row's line below 640 px, out of the panel's flow", () => {
    const phone = block(TABS, "@media (width < 40rem)")
    expect(phone).toMatch(
      /\.gf-tabs > \[data-panel\] section > \.gf-tab-aside \{\s*position: absolute;\s*top: 0\.25rem;\s*right: 0;\s*max-width: min\(9rem, 40%\);\s*\}/
    )
    expect(phone).toMatch(
      /\.gf-tabs:has\(> \[data-panel\] section > \.gf-tab-aside\) \{\s*position: relative;/
    )
    // The pills leave the link its room, the gutter the rail runs past its box counted
    expect(phone).toMatch(
      /> \.gf-tab-row \{\s*padding-inline-end: calc\(min\(9rem, 40%\) \+ var\(--gutter\)\);/
    )
    // A carousel's head keeps its row (its arrows stand there with the link)
    expect(phone).not.toContain("gf-scroller-head")
    // Only where `:has()` shows the pills at all
    expect(phone).toContain("@supports selector(:has(*))")
  })

  it("leaves the tablet and the desktop as they were", () => {
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
    // No other rule moves the aside between 640 and 1024 px
    expect(TABS.match(/gf-tab-aside/g)).toHaveLength(4)
  })
})
