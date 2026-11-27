import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { ProductPageView, TrustBadgeView } from "@qticaret/ui"
import { Assurances } from "../../../../../packages/themes/atolye/src/product/Assurances"

/**
 * The assurance tiles under the buy form (owner decision 2026-11-27): with
 * the shipping card, the shop's other promises show only as a group of two
 * or more, two to a row, an odd last tile spanning the row; the delivery
 * and return badges stay the card's. Without the card, the "Teslimat ve
 * iade" box is unchanged.
 */

const t = (key: string) => key
const badge = (icon: TrustBadgeView["icon"], title: string): TrustBadgeView => ({
  icon,
  title,
  text: null,
})
const OTHERS = [
  badge("shield", "Garanti"),
  badge("card", "Güvenli ödeme"),
  badge("award", "Orijinal ürün"),
  badge("phone", "Destek hattı"),
]
const DELIVERY = [badge("truck", "Hızlı kargo"), badge("refresh", "Kolay iade")]

const render = (trustBadges: TrustBadgeView[], withCard = true) =>
  renderToStaticMarkup(
    <Assurances
      view={
        {
          trustBadges,
          shippingNote: null,
          shipping: withCard ? {} : null,
        } as unknown as ProductPageView
      }
      t={t}
    />
  )
const tiles = (html: string) => [...html.matchAll(/<li class="([^"]*)"/g)].map((m) => m[1] ?? "")

describe("Assurances tiles beside the shipping card", () => {
  it("draws nothing with no tile left", () => {
    expect(render(DELIVERY)).toBe("")
  })

  it("draws nothing with a lone tile, even beside delivery badges", () => {
    expect(render([...DELIVERY, ...OTHERS.slice(0, 1)])).toBe("")
  })

  it("draws two tiles side by side", () => {
    const html = render([...DELIVERY, ...OTHERS.slice(0, 2)])
    // Two to a row at every width
    expect(html).toContain('class="grid grid-cols-2 gap-2"')
    const classes = tiles(html)
    expect(classes).toHaveLength(2)
    expect(classes.some((c) => c.includes("col-span-2"))).toBe(false)
  })

  it("lets the last of three tiles span the row", () => {
    const classes = tiles(render(OTHERS.slice(0, 3)))
    expect(classes).toHaveLength(3)
    expect(classes.map((c) => c.includes("col-span-2"))).toEqual([false, false, true])
  })

  it("keeps four tiles in even pairs", () => {
    const classes = tiles(render(OTHERS))
    expect(classes).toHaveLength(4)
    expect(classes.some((c) => c.includes("col-span-2"))).toBe(false)
  })
})

describe("Assurances tile text on narrow columns", () => {
  it("stacks a tile on a phone, its title two lines and its line one; icon beside from sm", () => {
    const html = render([
      {
        icon: "gift",
        title: "Sevdiklerinize Özel Bir Hediye",
        text: "Kutulu Seçeneklerle birlikte",
      },
      badge("card", "Mastercard"),
    ])
    expect(tiles(html).every((c) => c.includes("flex-col") && c.includes("sm:flex-row"))).toBe(true)
    expect(html).toMatch(
      /<span class="line-clamp-2 text-\[13px\][^"]*">Sevdiklerinize Özel Bir Hediye</
    )
    // The whole line stays in the markup, clamped to one line on a phone and two from sm
    expect(html).toMatch(
      /<span class="line-clamp-1 [^"]*sm:line-clamp-2">Kutulu Seçeneklerle birlikte<\/span>/
    )
  })
})

describe("Assurances without the shipping card", () => {
  it("keeps the delivery box for a single badge", () => {
    const html = render(OTHERS.slice(0, 1), false)
    expect(html).toContain('id="teslimat"')
    expect(html).toContain("Garanti")
  })
})
