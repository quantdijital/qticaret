import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, PlaceOrderResult, SectionBrandView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The home page's brands section: a brand with a logo shows it in place
 * of its name (the logo's alt text is the name) on its cell's own light
 * ground, at a fixed height; one without draws its name exactly as before.
 */

const home = (brands: SectionBrandView[]) =>
  renderPage(atolyeTheme, "HomePage", {
    view: {
      sections: [
        { id: "markalar", type: "brands", title: "Markalar", brands } satisfies HomeSectionView,
      ],
    },
    subscribe: (): Promise<PlaceOrderResult> =>
      Promise.resolve({ ok: true, error: null, challenge: null }),
  })

// The cell as the section drew it before logos (adr/0066: unchanged without one)
const CELL =
  '<a href="/marka/ada" class="gf-chip flex min-h-12 w-full justify-center rounded-button bg-field px-4 text-md whitespace-normal text-center shadow-[inset_0_0_0_1px_var(--color-rule)]">Ada</a>'

const logo = (name: string) => ({
  src: `https://cdn.example/${name.toLowerCase()}.png`,
  alt: name,
  width: null,
  height: null,
  sources: { avif: null, webp: null },
})

describe("the brands section", () => {
  it("draws a brand without a logo as its name, as before", () => {
    const html = home([
      { label: "Ada", path: "/marka/ada" },
      { label: "Ada", path: "/marka/ada-2", logo: null },
    ])
    expect(html).toContain(`<li class="min-w-0">${CELL}</li>`)
    expect(html).toContain(">Ada</a>")
    expect(html).not.toContain("<img")
  })

  it("draws a brand's logo in its place, named by the brand, at a fixed height", () => {
    const html = home([
      { label: "Ada", path: "/marka/ada" },
      { label: "Bora", path: "/marka/bora", logo: logo("Bora") },
    ])
    const cell = /<a href="\/marka\/bora"[^>]*>(.*?)<\/a>/.exec(html)?.[1] ?? ""
    expect(cell).toContain('src="https://cdn.example/bora.png"')
    expect(cell).toContain('alt="Bora"')
    expect(cell).toContain('loading="lazy"')
    // A fixed height row with no ground of its own: the row does not move as the file arrives, and
    // the logo stands on the cell itself, not on a plate inside it
    expect(cell).toContain('<span class="flex h-10 max-w-full items-center"><img')
    expect(cell).toMatch(/<img[^>]*class="h-9 w-auto max-w-full object-contain"/)
    // The name is the logo's alt text, not printed beside it
    expect(cell).not.toContain(">Bora<")
    // The cell is the logo's light ground (a mark's, which no section ground turns; its hover kept
    // light by `gf-logo-cell`) and keeps the cell's size (a 48 px target), its padding taken in
    // for the 40 px row
    const link = /<a href="\/marka\/bora" class="([^"]*)"/.exec(html)?.[1] ?? ""
    expect(link.split(" ")).toEqual(
      expect.arrayContaining(["gf-chip", "gf-logo-cell", "min-h-12", "w-full", "bg-chip", "py-1"])
    )
    expect(link.split(" ")).not.toContain("bg-field")
    // The brand without one keeps its name
    expect(html).toContain(CELL)
  })
})
