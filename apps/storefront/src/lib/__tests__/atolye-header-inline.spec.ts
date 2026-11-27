// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HeaderBarView, ShopView } from "@qticaret/ui"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * The one-row header (`header_bar` `inline`, "Tek satır"): the wordmark,
 * the main menu in the row's middle with the page's own link marked, the
 * round tools at the end; no second row, no top strip of links.
 */

const bar: HeaderBarView = { id: "mainheader", variant: "inline", sticky: true }

const MENU: ShopView["categories"] = [
  { label: "Ana sayfa", path: "/", children: [] },
  { label: "Turlar", path: "/magaza", children: [] },
  {
    label: "Rotalar",
    path: "/kategori/rotalar",
    children: [{ label: "Ege", path: "/kategori/rotalar/ege" }],
  },
]

const page = (over: Partial<ShopView> = {}) => {
  const html = renderFrame(atolyeTheme, shopFixture({ headerBar: bar, categories: MENU, ...over }))
  return new DOMParser().parseFromString(html, "text/html")
}

describe("the one-row header", () => {
  it("draws one row: the wordmark, the menu in the middle and the round tools", () => {
    const header = page().querySelector('[data-gf-head][data-variant="inline"]')
    const row = header?.querySelector("[data-gf-head-row]")

    expect(row).not.toBeNull()
    expect(header?.querySelectorAll("[data-gf-head-row]")).toHaveLength(1)
    expect(header?.querySelector("[data-gf-aisle]")).toBeNull()
    const menu = row?.querySelector('nav[aria-label="Kategoriler"]')
    expect(menu?.textContent).toContain("Turlar")
    // The dropdown of a link with children is there for a crawler, closed
    expect(menu?.querySelector('a[href="/kategori/rotalar/ege"]')).not.toBeNull()
    const tools = row?.querySelectorAll(".gf-tool")
    expect(tools?.length).toBeGreaterThanOrEqual(4)
  })

  it("marks the page's own link, and only it", () => {
    const home = page({ path: "/" })
    expect(home.querySelector('[data-gf-head] a[aria-current="page"]')?.getAttribute("href")).toBe(
      "/"
    )
    expect(home.querySelectorAll('[data-gf-head] a[aria-current="page"]')).toHaveLength(1)

    const shop = page({ path: "/magaza" })
    expect(shop.querySelector('[data-gf-head] a[aria-current="page"]')?.getAttribute("href")).toBe(
      "/magaza"
    )

    expect(page().querySelector('[data-gf-head] a[aria-current="page"]')).toBeNull()
  })

  it("keeps the top links out of a strip above it: they are in the menu sheet", () => {
    // As a one-row design stored before the strip was its own reads (owner 2026-11-27)
    const doc = page({
      topStrip: { variant: "graphite", links: false, phone: false, account: false },
    })
    const header = doc.querySelector("[data-gf-head]")
    const before = [...doc.querySelectorAll('a[href="/hakkimizda"]')].filter(
      (link) => header?.contains(link) !== true
    )

    expect(before).toHaveLength(0)
  })

  it("draws the tools as round icons only when the shop hides their words, names kept", () => {
    const words = page().querySelector('[data-gf-head][data-variant="inline"]')
    expect(words?.hasAttribute("data-tool-words")).toBe(false)

    const icons = page({ headerBar: { ...bar, toolLabels: "hide" } }).querySelector(
      '[data-gf-head][data-variant="inline"]'
    )
    expect(icons?.getAttribute("data-tool-words")).toBe("hidden")
    expect(icons?.hasAttribute("data-tools")).toBe(false)
    const cart = icons?.querySelector('a[href="/sepet"]')
    expect(cart?.getAttribute("aria-label")).toBeTruthy()
  })

  it("draws plain tools and the action pill only when the shop chose them", () => {
    const round = page({
      headerBar: { ...bar, highlight: { label: "Tur planla", path: "/iletisim" } },
    })
    expect(round.querySelector("[data-tools]")).toBeNull()
    expect(round.body.innerHTML).not.toContain("Tur planla")

    const plain = page({
      headerBar: {
        ...bar,
        toolsStyle: "plain",
        highlight: { label: "Tur planla", path: "/iletisim" },
      },
    })
    const header = plain.querySelector('[data-gf-head][data-variant="inline"]')
    expect(header?.getAttribute("data-tools")).toBe("plain")
    expect(header?.querySelector('a[href="/hesap"]')?.className).toContain("gf-icon-btn")
    const pill = header?.querySelector('a.gf-btn[href="/iletisim"]')
    expect(pill?.textContent).toContain("Tur planla")
    // Favourites leave the desktop row; the phone row still has them
    expect(header?.querySelector('a[href="/hesap/favoriler"]')?.className).toContain("lg:hidden")
  })

  it("draws the plain tools whole when their words are hidden too: two marks, one drawing", () => {
    const html = (headerBar: HeaderBarView) =>
      page({ headerBar: { ...headerBar, highlight: { label: "Tur planla", path: "/iletisim" } } })
    const plain = html({ ...bar, toolsStyle: "plain" })
    const both = html({ ...bar, toolsStyle: "plain", toolLabels: "hide" })
    const header = both.querySelector('[data-gf-head][data-variant="inline"]')
    if (header === null) throw new Error("no one-row header")

    expect(header.getAttribute("data-tools")).toBe("plain")
    expect(header.getAttribute("data-tool-words")).toBe("hidden")
    // The words rule (`header-inline.css`) finds no word among the plain tools: the same row and pill
    expect(header.querySelector('.gf-tool > span[aria-hidden="true"]')).toBeNull()
    const row = (doc: Document) => doc.querySelector("[data-gf-head-row]")?.innerHTML
    expect(row(both)).toBe(row(plain))
    expect(header.querySelector('a.gf-btn[href="/iletisim"]')?.textContent).toContain("Tur planla")
    expect(header.querySelector('a[href="/sepet"]')?.getAttribute("aria-label")).toBeTruthy()
  })

  it("leaves the other headers' markup as it was", () => {
    const standard = renderFrame(
      atolyeTheme,
      shopFixture({ headerBar: { ...bar, variant: "standard" }, categories: MENU, path: "/" })
    )
    const header = /<header[\s\S]*?<\/header>/.exec(standard)?.[0] ?? ""
    expect(header).not.toBe("")
    expect(header).not.toContain('aria-current="page"')
    expect(standard).not.toContain('data-variant="inline"')
  })
})
