import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView, PlaceOrderResult, SectionBrandView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * The home page's brands section: a brand with a logo shows it in place
 * of its name (the logo's alt text is the name) on a light plate of a
 * fixed height; one without draws its name exactly as before logos.
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
    // The plate is light on any ground and a fixed height: the row does not move as the file arrives
    expect(cell).toMatch(/<span class="[^"]*\bh-10\b[^"]*\bbg-chip\b/)
    expect(cell).toMatch(/<img[^>]*class="h-7 w-auto max-w-full object-contain"/)
    // The name is the logo's alt text, not printed beside it
    expect(cell).not.toContain(">Bora<")
    // The link keeps the cell's size: a 48 px target
    expect(html).toContain('<a href="/marka/bora" class="gf-chip flex min-h-12 w-full')
    // The brand without one keeps its name
    expect(html).toContain(CELL)
  })
})
