// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderBarView, HeaderCatalogView, ShopView, TopStripView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"
import { topStripOf } from "../views/top-strip"

/**
 * The top strip as its own section (owner's decision 2026-11-27, adr/0066
 * Ek): whatever the header's variant, nothing is drawn above it but the
 * shop's strip, in its design (`graphite` above the header, `light` at the
 * header's top) and with the parts the shop left on.
 */

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
const CATALOG_BAR: HeaderBarView = { ...STANDARD, variant: "catalog", catalog: CATALOG }
const GRAPHITE: TopStripView = { variant: "graphite", links: true, phone: true, account: false }
const LIGHT: TopStripView = { variant: "light", links: true, phone: true, account: false }

const page = (over: Partial<ShopView>, strip = true) => {
  const shop = shopFixture(over)
  if (!strip) {
    delete shop.topStrip
  }
  return new DOMParser().parseFromString(renderFrame(atolyeTheme, shop), "text/html")
}

const linksNav = 'nav[aria-label="Kurumsal bağlantılar"]'

describe("the top strip", () => {
  it("draws nothing above any header without a strip section", () => {
    for (const headerBar of [STANDARD, CATALOG_BAR]) {
      const doc = page({ headerBar, announcements: [] }, false)
      expect(doc.querySelector(".gf-stage")).toBeNull()
      expect(doc.querySelector("[data-gf-strip]")).toBeNull()
      expect(doc.querySelector(linksNav)).toBeNull()
    }
  })

  it("draws the dark bar with its lines, links and phone, each as left on", () => {
    const on = page({ headerBar: CATALOG_BAR, announcements: ["Kargo bedava"], topStrip: GRAPHITE })
    expect(on.querySelector('[aria-label="Duyurular"]')?.textContent).toBe("Kargo bedava")
    expect(on.querySelector(`.gf-stage ${linksNav}`)).not.toBeNull()
    expect(on.querySelector('.gf-stage a[href^="tel:"]')).not.toBeNull()
    const off = page({
      headerBar: STANDARD,
      announcements: ["Kargo bedava"],
      topStrip: { ...GRAPHITE, links: false, phone: false },
    })
    expect(off.querySelector(linksNav)).toBeNull()
    expect(off.querySelector('.gf-stage a[href^="tel:"]')).toBeNull()
  })

  it("draws the light strip at the top of every header, its note first", () => {
    for (const headerBar of [STANDARD, CATALOG_BAR]) {
      const doc = page({ headerBar, announcements: ["Kargo bedava"], topStrip: LIGHT })
      const strip = doc.querySelector("header > [data-gf-strip]")
      expect(strip?.querySelector("p")?.textContent).toBe("Kargo bedava")
      expect(strip?.querySelector(linksNav)).not.toBeNull()
      expect(doc.querySelector(".gf-stage")).toBeNull()
    }
    // Nothing to show: not drawn
    const empty = page({ headerBar: STANDARD, topStrip: { ...LIGHT, links: false } })
    expect(empty.querySelector("[data-gf-strip]")).toBeNull()
  })

  it("reads the store's strip: an unknown design the dark bar, parts shown unless off", () => {
    const bar = { id: "ustserit", type: "announcement_bar" as const, lines: [] }
    expect(topStripOf(bar)).toEqual(GRAPHITE)
    expect(topStripOf({ ...bar, variant: "light", links: false, account: true })).toEqual({
      variant: "light",
      links: false,
      phone: true,
      account: true,
    })
  })
})
