import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { CategoryPanelsView, HomeSectionView, LinkedCategoryCardView } from "@qticaret/ui"
import {
  BESIDE_MAX,
  besideRows,
  panelPlaces,
} from "../../../../../packages/themes/atolye/src/sections/panel-rows"
import { atolyeCss } from "@/test/atolye-css"
import { renderPage } from "@/test/theme-render"

/**
 * The category cards' `panels` variant (adr/0049 Ek 2026-11-19): frameless
 * graphite panels led by their photos, the first tall beside the others.
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
  all: null,
})

const NAMES = ["Mutfak", "Bahçe", "Banyo", "Salon", "Ofis", "Çocuk", "Hobi", "Spor"]

const panels = (
  list: LinkedCategoryCardView[],
  over: Partial<CategoryPanelsView> = {}
): HomeSectionView => ({
  id: "panolar",
  type: "categories",
  title: "Kullanıma göre",
  categories: list,
  variant: "panels",
  panels: { columns: 3, height: "medium", lead: true, cards: list, ...over },
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

/** Each panel's `<li>` classes, in order. */
const items = (html: string) =>
  [...html.matchAll(/<li class="(min-w-0 col-span-[^"]+)"/g)].map((match) => match[1] ?? "")

/** A wide screen's grid: every row of the right half and every row below fills its twelve. */
function fillsRows(spans: number[], leadRows: number): boolean {
  const [lead, ...rest] = spans
  let cells = (lead ?? 0) * leadRows
  for (const span of rest) {
    cells += span
  }
  return cells % 12 === 0
}

describe("the category panels' places", () => {
  it("stacks the others beside the lead, the odd one alone and first", () => {
    expect(besideRows(1)).toEqual([1])
    expect(besideRows(2)).toEqual([1, 1])
    expect(besideRows(3)).toEqual([1, 2])
    expect(besideRows(4)).toEqual([2, 2])
    expect(besideRows(5)).toEqual([1, 2, 2])
    expect(besideRows(0)).toEqual([])
  })

  it("fills the wide screen's grid for two to eight panels, with the lead or without", () => {
    for (let count = 2; count <= 8; count++) {
      for (const lead of [true, false]) {
        for (const columns of [2, 3, 4]) {
          const places = panelPlaces(count, lead, columns, 1)
          expect(places).toHaveLength(count)
          const rows = places[0]?.rows ?? 1
          expect(
            fillsRows(
              places.map((place) => place.xl),
              rows
            )
          ).toBe(true)
          expect(
            fillsRows(
              places.map((place) => place.lg),
              rows
            )
          ).toBe(true)
        }
      }
    }
  })

  it("draws three as the lead on the left half and two wide panels stacked beside it", () => {
    const [lead, second, third] = panelPlaces(3, true, 3, 1)
    expect(lead).toMatchObject({ phone: 12, tablet: 12, lg: 6, xl: 6, rows: 2, lead: true })
    expect(lead?.wide).toEqual([])
    expect(second).toMatchObject({ phone: 12, tablet: 6, lg: 6, xl: 6, rows: 1 })
    expect(second?.wide).toEqual(["phone", "lg", "xl"])
    expect(third?.wide).toEqual(["phone", "lg", "xl"])
  })

  it("keeps at most five beside the lead, the rest in rows under it", () => {
    const places = panelPlaces(8, true, 3, 1)
    expect(places[0]?.rows).toBe(3)
    expect(places.slice(1, 1 + BESIDE_MAX).map((place) => place.xl)).toEqual([6, 3, 3, 3, 3])
    expect(places.slice(1 + BESIDE_MAX).map((place) => place.xl)).toEqual([6, 6])
  })

  it("lays out rows without the lead, a phone two a row when asked", () => {
    expect(panelPlaces(3, false, 3, 2).map((place) => [place.phone, place.xl])).toEqual([
      [6, 4],
      [6, 4],
      [12, 4],
    ])
    expect(panelPlaces(3, false, 3, 2)[0]?.wide).toEqual([])
    expect(panelPlaces(1, true, 3, 1)).toEqual([
      expect.objectContaining({ lead: false, xl: 12, rows: 1 }),
    ])
  })
})

describe("the category panels", () => {
  it("draws each panel as one link with its photo, name, count and subcategories", () => {
    const list = [card("Mutfak", ["Tencere", "Tava"], { count: 42 }), card("Bahçe", ["Hortum"])]
    const html = home([panels(list)])

    expect(html).toContain(">Kullanıma göre</h2>")
    expect(html.match(/<h3/g)).toHaveLength(2)
    expect(html.match(/gf-panel-link no-underline after:absolute after:inset-0/g)).toHaveLength(2)
    expect(html).toContain('href="/kategori/tencere"')
    expect(html).toContain('href="/kategori/hortum"')
    expect(html).toContain("42 ürün")
    // The words stand on the graphite in its own inks; no frame, no per-card "see all"
    expect(html).toContain("bg-stage text-stage-text")
    expect(html).not.toContain("gf-pane ")
    expect(html).not.toContain("Tümünü gör<span")
    expect(html).toMatch(
      /<img[^>]*alt=""[^>]*src="\/media\/Mutfak\.jpg"|src="\/media\/Mutfak\.jpg"[^>]*alt=""/
    )
    expect(html).toContain('data-height="medium"')
    expect(html).toContain("data-lead")
  })

  it("names the lead's rows and the wide panels' screens for three categories", () => {
    const html = home([panels(NAMES.slice(0, 3).map((name) => card(name, ["Alt"])))])
    const [lead, second] = items(html)
    expect(lead).toBe(
      "min-w-0 col-span-12 sm:col-span-12 lg:col-span-6 xl:col-span-6 lg:row-span-2"
    )
    expect(second).toBe("min-w-0 col-span-12 sm:col-span-6 lg:col-span-6 xl:col-span-6")
    expect(html).toContain('data-wide="phone lg xl"')
  })

  it("lays out two to six panels, each a heading and a link", () => {
    for (let count = 2; count <= 6; count++) {
      const html = home([panels(NAMES.slice(0, count).map((name) => card(name, ["Alt"])))])
      expect(items(html)).toHaveLength(count)
      expect(html.match(/<h3/g)).toHaveLength(count)
    }
  })

  it("keeps a panel without a photo, without subcategories or with a long name whole", () => {
    const long = "Profesyonel Mutfak Ekipmanları ve Restoran Gereçleri"
    const html = home([panels([card(long, [], { image: false }), card("Bahçe", [])])])
    expect(html).toMatch(
      /aria-hidden="true" class="absolute inset-0 grid place-items-center[^"]*">P</
    )
    expect(html).not.toContain('<ul class="relative z-[1] mt-2')
    expect(html).toContain("break-words")
    expect(html).toContain(long)
  })

  it("draws no count when the shop hides counts, equal panels without the lead", () => {
    const list = [card("Mutfak", []), card("Bahçe", []), card("Banyo", [])]
    const html = home([panels(list, { lead: false, height: "high", phoneColumns: 2 })])
    expect(html).not.toContain("ürün</p>")
    expect(html).not.toContain("data-lead")
    expect(html).toContain('data-height="high"')
    expect(items(html)[0]).toBe("min-w-0 col-span-6 sm:col-span-6 lg:col-span-4 xl:col-span-4")
  })

  it("draws today's tiles for a section without the panels' view", () => {
    const html = home([{ ...panels([card("Mutfak", [])]), panels: null } as HomeSectionView])
    expect(html).not.toContain("gf-panel")
    expect(html).toContain(">Kullanıma göre</h2>")
  })

  it("moves one thing on hover, nothing under reduced motion, and rings the panel on focus", () => {
    const css = atolyeCss("panels.css")
    expect(css).toMatch(
      /@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\) \{\s*\.gf-panel:hover \.gf-panel-photo img \{\s*transform: scale\(1\.04\);/
    )
    expect(css).toContain(".gf-panel:has(.gf-panel-link:focus-visible)")
    // Every wide screen has its own block: the words beside the photo only there
    for (const screen of ["phone", "tablet", "lg", "xl"]) {
      expect(css).toContain(`.gf-panel[data-wide~="${screen}"] > .gf-panel-words`)
    }
    expect(atolyeCss("styles.css")).toContain('@import "./panels.css";')
  })
})
