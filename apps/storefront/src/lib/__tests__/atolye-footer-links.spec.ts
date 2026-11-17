import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { renderFrame, shopFixture } from "@/test/theme-render"

/**
 * A footer menu's link that leaves the shop carries no opener and no
 * referrer; a link of the shop's own carries no `rel`.
 */
describe("the footer's menu links", () => {
  it("prints an outside address with rel=noopener noreferrer, the shop's own without", () => {
    const html = renderFrame(
      atolyeTheme,
      shopFixture({
        footerGroups: [
          {
            title: "Yardım",
            links: [
              { label: "İletişim", path: "/iletisim" },
              { label: "Kargo takibi", path: "https://kargo.example/takip" },
            ],
          },
        ],
      })
    )
    const anchor = (href: string) => new RegExp(`<a[^>]*href="${href}"[^>]*>`).exec(html)?.[0]

    expect(anchor("https://kargo.example/takip")).toContain('rel="noopener noreferrer"')
    expect(anchor("/iletisim")).toBeDefined()
    expect(anchor("/iletisim")).not.toContain("rel=")
  })
})
