// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { MARQUEE_DEFAULTS } from "@qticaret/types/section-marquee"
import type { StoreMainSections } from "@qticaret/types"
import type { HeaderBarView, HeaderCatalogView, MarqueeSectionView, ShopView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { headerBarOf } from "../views/main-sections"

/**
 * The shop's top strip switch (`header_bar.top_strip`, owner 2026-11-27):
 * off, nothing above the header's own row is drawn on any width, neither
 * the bar above the header (its lines, top links and phone) nor the
 * header's scrolling strip nor the catalog header's thin strip, and the top
 * links never fall back to the bar when the catalog's own strip is off. On
 * (absent), every frame is the one from before the switch.
 */

const MARQUEE: MarqueeSectionView = {
  ...MARQUEE_DEFAULTS,
  id: "kayan1",
  type: "marquee",
  items: [{ icon: null, text: "30 gün içinde iade", subtext: null, link: null }],
  speed: "medium",
  direction: "left",
  ground: "stage",
  size: "medium",
  separator: "dot",
}

const CATALOG: HeaderCatalogView = {
  searchPlaceholder: null,
  searchLabel: false,
  accountText: true,
  cartTotal: false,
  highlight: null,
  utilityBar: true,
  phone: true,
  categories: [],
  menuGround: "stage",
}

const STANDARD: HeaderBarView = { id: "mainheader", variant: "standard", sticky: true }

const page = (over: Partial<ShopView>) => {
  const html = renderFrame(atolyeTheme, shopFixture(over))
  return { html, doc: new DOMParser().parseFromString(html, "text/html") }
}

const full = { announcements: ["Kargo bedava"], marquee: MARQUEE }

describe("the top strip switch", () => {
  it("draws the bar, its links and phone and the scrolling strip while on", () => {
    const { html, doc } = page({ ...full, headerBar: STANDARD })
    expect(doc.querySelector('[aria-label="Duyurular"]')?.textContent).toBe("Kargo bedava")
    expect(doc.querySelector('nav[aria-label="Kurumsal bağlantılar"]')).not.toBeNull()
    expect(html).toContain("gf-marquee")
  })

  it("draws nothing above the header once off: no bar, no links, no phone, no strip", () => {
    const { html, doc } = page({ ...full, headerBar: { ...STANDARD, topStripOff: true } })
    expect(doc.querySelector('[aria-label="Duyurular"]')).toBeNull()
    expect(doc.querySelector('nav[aria-label="Kurumsal bağlantılar"]')).toBeNull()
    expect(doc.querySelector(".gf-stage")).toBeNull()
    expect(html).not.toContain("gf-marquee")
    // The first thing after the skip link is the header itself
    expect(doc.querySelector("[data-gf-head]")).not.toBeNull()
  })

  it("leaves no links-only bar behind once the announcement is gone, when off", () => {
    const on = page({ headerBar: STANDARD }).doc
    // Today's drawing: without lines the bar still carries the top links from 1024 px
    expect(on.querySelector('nav[aria-label="Kurumsal bağlantılar"]')).not.toBeNull()
    const off = page({ headerBar: { ...STANDARD, topStripOff: true } }).doc
    expect(off.querySelector('nav[aria-label="Kurumsal bağlantılar"]')).toBeNull()
  })

  it("takes the catalog header's own strip too, and lets nothing fall back to the bar", () => {
    const catalog = (set: Partial<HeaderCatalogView>, off: boolean) =>
      page({
        headerBar: {
          ...STANDARD,
          variant: "catalog",
          catalog: { ...CATALOG, ...set },
          ...(off ? { topStripOff: true as const } : {}),
        },
      })
    // On: the catalog's strip holds the links; its strip switched off, the bar above takes them
    expect(catalog({}, false).doc.querySelector("[data-gf-strip]")).not.toBeNull()
    expect(catalog({ utilityBar: false }, false).doc.querySelector(".gf-stage nav")).not.toBeNull()
    // Off: neither strip, whatever the catalog's own switch says
    for (const utilityBar of [true, false]) {
      const { doc } = catalog({ utilityBar }, true)
      expect(doc.querySelector("[data-gf-strip]")).toBeNull()
      expect(doc.querySelector('nav[aria-label="Kurumsal bağlantılar"]')).toBeNull()
    }
  })

  it("is read only when false: a bar without it is the view it was", () => {
    const theme = { header: { layout: "left", sticky: true } } as const
    const main = (bar: Partial<StoreMainSections["header_bar"]>) =>
      ({
        header_bar: {
          id: "mainheader",
          type: "header_bar",
          variant: "standard",
          sticky: true,
          ...bar,
        },
      }) as StoreMainSections
    expect(headerBarOf(main({ top_strip: false }), theme).topStripOff).toBe(true)
    expect(headerBarOf(main({}), theme)).not.toHaveProperty("topStripOff")
    expect(headerBarOf(main({ top_strip: true }), theme)).not.toHaveProperty("topStripOff")
  })
})
