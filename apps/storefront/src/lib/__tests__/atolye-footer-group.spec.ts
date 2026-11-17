import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, ShopView } from "@qticaret/ui"
import { renderFrame, renderPage, shopFixture } from "@/test/theme-render"

/**
 * The footer group (adr/0070 §4): its sections above the footer bar, in
 * the group's order, drawn by the page sections' components; none on the
 * pages of paying. The free rows footer's newsletter band is one of them,
 * no longer a band inside the footer.
 */

const SECTIONS: HomeSectionView[] = [
  {
    id: "altkayan01",
    type: "marquee",
    items: [{ icon: null, text: "Aynı gün kargo", subtext: null, link: null }],
  } as HomeSectionView,
  { id: "altmetin01", type: "rich_text", title: "Neden biz", html: "<p>Özenle paketlenir.</p>" },
  {
    id: "altguven01",
    type: "trust_badges",
    variant: "lined",
    badges: [{ icon: "truck", title: "Ücretsiz kargo", text: null }],
  },
]

const subscribe = () => Promise.resolve({ ok: true, error: null, challenge: null })
const frame = (shop: ShopView) =>
  renderPage(atolyeTheme, "Layout", {
    shop,
    children: createElement("p", null, "Sayfa"),
    saveCookies: () => Promise.resolve(),
    subscribe,
  })

describe("the footer group (adr/0070 §4)", () => {
  it("draws its sections above the footer bar, in the group's order", () => {
    const html = renderFrame(atolyeTheme, shopFixture({ footerSections: SECTIONS }))
    const group = html.indexOf("data-footer-group")
    const at = (text: string) => html.indexOf(text)

    expect(group).toBeGreaterThan(at("Sayfa"))
    expect(at("Aynı gün kargo")).toBeGreaterThan(group)
    expect(at("Neden biz")).toBeGreaterThan(at("Aynı gün kargo"))
    expect(at("Ücretsiz kargo")).toBeGreaterThan(at("Neden biz"))
    expect(at("<footer")).toBeGreaterThan(at("Ücretsiz kargo"))
  })

  it("draws nothing above the footer without sections, nor on the pages of paying", () => {
    expect(renderFrame(atolyeTheme, shopFixture())).not.toContain("data-footer-group")
    expect(
      renderFrame(atolyeTheme, shopFixture({ footerSections: SECTIONS, checkout: true }))
    ).not.toContain("data-footer-group")
  })

  it("draws the free rows footer's newsletter as a band of the group, not inside the footer", () => {
    const band: HomeSectionView = {
      id: "altbulten1",
      type: "newsletter",
      title: "Haberdar olun",
      text: "Onay metni.",
      privacyPath: null,
      variant: "split",
    }
    const html = frame(
      shopFixture({
        footerBar: {
          id: "mainfooter",
          variant: "free_rows",
          freeRows: { ground: "well", badgeStyle: "card", bottomBadges: true },
          rows: [],
        } as unknown as NonNullable<ShopView["footerBar"]>,
        newsletter: { title: "Haberdar olun", text: "Onay metni.", variant: "split" },
        footerSections: [band],
      })
    )
    const footer = html.slice(html.indexOf("<footer"))

    expect(html.indexOf("Haberdar olun")).toBeLessThan(html.indexOf("<footer"))
    expect(footer).not.toContain("Haberdar olun")
    expect(footer).not.toContain("gf-foot-band")
  })
})
