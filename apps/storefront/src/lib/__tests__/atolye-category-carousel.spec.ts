import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CategoryCardView, HomeSectionView } from "@qticaret/ui"
import { SCROLLER_DEFAULTS } from "@qticaret/types/section-scroller"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"

/** The categories' `carousel`: the tiles' picture cards in one sliding row (the scroller kit). */

const card = (name: string, count?: number): CategoryCardView => ({
  label: name,
  path: `/kategori/${name.toLowerCase()}`,
  image: {
    src: `/media/${name}.jpg`,
    alt: name,
    width: 800,
    height: 1000,
    sources: { avif: null, webp: null },
  },
  ...(count === undefined ? {} : { count }),
})

const NAMES = ["Mutfak", "Bahçe", "Banyo", "Salon", "Ofis", "Çocuk"]

const section = (
  over: Partial<HomeSectionView & { type: "categories" }> = {}
): HomeSectionView => ({
  id: "kayankat",
  type: "categories",
  title: "Popüler kategoriler",
  categories: NAMES.map((name) => card(name)),
  variant: "carousel",
  scroller: SCROLLER_DEFAULTS,
  ...over,
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const count = (html: string, needle: string) => html.split(needle).length - 1

describe("the categories' sliding cards in Atölye", () => {
  it("draws every category as a picture card in the scroller, its arrows named", () => {
    const html = home([section()])
    expect(html).toContain("gf-scroller")
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Popüler kategoriler"')
    expect(html).toContain(`aria-label="${t("scroller.next")}"`)
    for (const name of NAMES) {
      expect(html).toContain(`href="/kategori/${name.toLowerCase()}"`)
      expect(html).toContain(`>${name}</span>`)
    }
    expect(count(html, 'src="/media/')).toBeGreaterThanOrEqual(NAMES.length)
    // The section's link beside the head: every category, as the tiles'
    expect(html).toContain('href="/kategoriler"')
  })

  it("puts each card's count under its name only when the view carries it", () => {
    const quiet = home([section()])
    expect(quiet).not.toContain(t("listing.count", { count: "12" }))
    const counted = home([section({ categories: [card("Mutfak", 12), card("Bahçe", 3)] })])
    expect(counted).toContain(t("listing.count", { count: "12" }))
    expect(counted).toContain(t("listing.count", { count: "3" }))
  })

  it("draws today's tiles when the view lacks the scroller (an older storefront)", () => {
    const html = home([section({ scroller: null })])
    expect(html).not.toContain("gf-scroller")
    expect(html).toContain("gf-rail")
  })
})
