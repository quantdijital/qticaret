import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CategoryCollageView, HomeSectionView, LinkedCategoryCardView } from "@qticaret/ui"
import {
  collageCards,
  collageRows,
} from "../../../../../packages/themes/atolye/src/sections/collage-rows"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The category cards' `collage` variant (adr/0049 Ek 2026-11-15): photo-led
 * cards filling each row, the first wider while `lead` is on.
 */

const card = (
  name: string,
  children: string[],
  { count, image = true }: { count?: number; image?: boolean } = {}
): LinkedCategoryCardView => ({
  label: name,
  path: `/kategori/${name.toLowerCase()}`,
  ...(image
    ? {
        image: {
          src: `/media/${name}.jpg`,
          alt: name,
          width: 800,
          height: 600,
          sources: { avif: null, webp: null },
        },
      }
    : {}),
  ...(count === undefined ? {} : { count }),
  children: children.map((child) => ({ label: child, path: `/kategori/${child.toLowerCase()}` })),
  all:
    children.length > 0 ? { label: "Tümünü gör", path: `/kategori/${name.toLowerCase()}` } : null,
})

const NAMES = ["Mutfak", "Bahçe", "Banyo", "Salon", "Ofis", "Çocuk"]

const collage = (
  list: LinkedCategoryCardView[],
  over: Partial<CategoryCollageView> = {}
): HomeSectionView => ({
  id: "kolaj",
  type: "categories",
  title: "Kullanıma göre",
  categories: list,
  variant: "collage",
  collage: { columns: 4, height: "medium", lead: true, cards: list, ...over },
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

/** Each card's `<li>` classes, in order. */
const items = (html: string) =>
  [...html.matchAll(/<li class="(min-w-0 col-span-[^"]+)"/g)].map((match) => match[1] ?? "")

describe("the category collage's rows", () => {
  it("fills every row edge to edge for two to six cards, the lead two wide", () => {
    const sum = (spans: number[]) => spans.reduce((total, span) => total + span, 0)
    for (let count = 2; count <= 6; count++) {
      for (const lead of [true, false]) {
        for (const perRow of [2, 3, 4]) {
          const places = collageRows(count, lead, perRow)
          expect(places).toHaveLength(count)
          const rows = Math.max(...places.map((place) => place.row)) + 1
          for (let row = 0; row < rows; row++) {
            expect(sum(places.filter((place) => place.row === row).map((p) => p.span))).toBe(12)
          }
        }
      }
    }
  })

  it("shares the units out evenly: no stray card while another row is full", () => {
    const spans = (count: number, lead: boolean, perRow: number) =>
      collageRows(count, lead, perRow).map((place) => place.span)
    expect(spans(3, true, 4)).toEqual([6, 3, 3])
    expect(spans(3, true, 3)).toEqual([12, 6, 6])
    expect(spans(4, true, 4)).toEqual([8, 4, 6, 6])
    expect(spans(5, true, 4)).toEqual([8, 4, 4, 4, 4])
    expect(spans(6, true, 3)).toEqual([8, 4, 6, 6, 6, 6])
    expect(spans(6, false, 4)).toEqual([4, 4, 4, 4, 4, 4])
    expect(spans(5, false, 4)).toEqual([4, 4, 4, 6, 6])
    expect(spans(1, true, 4)).toEqual([12])
    expect(collageRows(0, true, 4)).toEqual([])
  })

  it("takes at most three a row from 1024 px, the shop's count from 1280 px", () => {
    const [lead, second] = collageCards(3, true, 4, 1)
    expect(lead).toMatchObject({ phone: 12, tablet: 12, lg: 12, xl: 6, lead: true, alone: ["lg"] })
    expect(second).toMatchObject({ phone: 12, tablet: 6, lg: 6, xl: 3, lead: false, alone: [] })
    expect(collageCards(4, false, 4, 2).map((place) => place.phone)).toEqual([6, 6, 6, 6])
  })
})

describe("the category collage", () => {
  it("draws each card as one link with its photo, name, count and subcategories", () => {
    const list = [card("Mutfak", ["Tencere", "Tava"], { count: 42 }), card("Bahçe", ["Hortum"])]
    const html = home([collage(list)])

    expect(html).toContain(">Kullanıma göre</h2>")
    expect(html.match(/<h3/g)).toHaveLength(2)
    // The whole card is the category's link; the subcategories are their own stops
    expect(html.match(/gf-collage-link no-underline after:absolute after:inset-0/g)).toHaveLength(2)
    expect(html).toContain('href="/kategori/tencere"')
    expect(html).toContain('href="/kategori/hortum"')
    expect(html).toContain("42 ürün")
    // No per-card "see all", no arrow: the card itself goes there
    expect(html).not.toContain("Tümünü gör<span")
    expect(html).not.toContain("lucide-arrow-right")
    // The photo is decoration beside the name: no alt text to read twice
    expect(html).toMatch(
      /<img[^>]*alt=""[^>]*src="\/media\/Mutfak\.jpg"|src="\/media\/Mutfak\.jpg"[^>]*alt=""/
    )
    expect(html).toContain('data-height="medium"')
    expect(html).toContain("data-lead")
    expect(html).toContain("data-phone-rows")
  })

  it("lays out two to six cards in rows of twelve, the lead wider", () => {
    for (let count = 2; count <= 6; count++) {
      const list = NAMES.slice(0, count).map((name) => card(name, ["Alt"]))
      const html = home([collage(list)])
      expect(items(html)).toHaveLength(count)
      expect(html.match(/<h3/g)).toHaveLength(count)
    }
    const three = items(home([collage(NAMES.slice(0, 3).map((name) => card(name, [])))]))
    expect(three[0]).toBe("min-w-0 col-span-12 sm:col-span-12 lg:col-span-12 xl:col-span-6")
    expect(three[1]).toBe("min-w-0 col-span-12 sm:col-span-6 lg:col-span-6 xl:col-span-3")
  })

  it("keeps a card without a photo, without subcategories or with a long name whole", () => {
    const long = "Profesyonel Mutfak Ekipmanları ve Restoran Gereçleri"
    const html = home([collage([card(long, [], { image: false }), card("Bahçe", [])])])
    // The name's first letter keeps the photo's place
    expect(html).toMatch(/aria-hidden="true" class="grid h-full place-items-center[^"]*">P</)
    expect(html).not.toContain("gf-collage-links")
    expect(html).toContain("break-words")
    expect(html).toContain(long)
  })

  it("draws no count when the shop hides counts, equal cards without the lead", () => {
    const list = [card("Mutfak", []), card("Bahçe", []), card("Banyo", [])]
    const html = home([collage(list, { lead: false, height: "high", phoneColumns: 2 })])
    expect(html).not.toContain("ürün</p>")
    expect(html).not.toContain("data-lead")
    expect(html).not.toContain("data-phone-rows")
    expect(html).toContain('data-height="high"')
    expect(items(html)[0]).toBe("min-w-0 col-span-6 sm:col-span-6 lg:col-span-4 xl:col-span-4")
  })

  it("draws today's tiles for a section without the collage's view", () => {
    const list = [card("Mutfak", [])]
    const html = home([
      {
        id: "kolaj",
        type: "categories",
        title: "Kullanıma göre",
        categories: list,
        variant: "collage",
        collage: null,
      },
    ])
    expect(html).not.toContain("gf-collage")
    expect(html).toContain(">Kullanıma göre</h2>")
  })

  it("moves one thing on hover, nothing under reduced motion, and frames the card on focus", () => {
    const css = atolyeCss("collage.css")
    expect(css).toMatch(
      /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\) \{\s*\.gf-collage-card:hover \.gf-collage-photo img \{\s*transform: scale\(1\.04\);/
    )
    expect(css).toContain(".gf-collage-card:has(.gf-collage-link:focus-visible)")
    expect(atolyeCss("styles.css")).toContain('@import "./collage.css";')
  })
})
