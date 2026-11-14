import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import type { HomeSectionView } from "@qticaret/ui"
import { renderPage } from "@/test/theme-render"

/**
 * A section's look in Atölye (adr/0049 Ek 2026-11-14 §6): a box naming the
 * steps the shop set, mapped onto the theme's tokens in `look.css`; a
 * section left to the theme draws exactly as before looks.
 */

const faq = (id: string, look?: HomeSectionView["look"]): HomeSectionView => ({
  id,
  type: "faq",
  title: "Sorular",
  items: [{ question: "Kargo ne zaman?", answer: "Aynı gün." }],
  ...(look ? { look } : {}),
})

const home = (sections: HomeSectionView[]) =>
  renderPage(atolyeTheme, "HomePage", { view: { sections } })

const LOOK_CSS = readFileSync(
  path.resolve(import.meta.dirname, "../../../../../packages/themes/atolye/src/look.css"),
  "utf8"
)

describe("a section's look in Atölye", () => {
  it("draws a section without a look with no box around it", () => {
    const html = home([faq("sss1")])
    expect(html).not.toContain("gf-look")
  })

  it("names each step the shop set on the section's box, and only those", () => {
    const html = home([
      faq("sss1", { space_outer: "none", ground: "well", align: "center", width: "narrow" }),
    ])
    const box = /<div class="([^"]*gf-look[^"]*)"([^>]*)>/.exec(html)
    expect(box?.[1]).toContain("group/look")
    expect(box?.[2]).toContain('data-outer="none"')
    expect(box?.[2]).toContain('data-ground="well"')
    expect(box?.[2]).toContain('data-align="center"')
    expect(box?.[2]).toContain('data-width="narrow"')
    expect(box?.[2]).not.toContain("data-inner")
    // The steps are attributes and tokens, never inline style (adr/0049 Ek 2026-11-14 §8)
    expect(box?.[0]).not.toContain("style=")
  })

  it("puts the dark stage's ground on the theme's own graphite", () => {
    const html = home([faq("sss1", { ground: "stage" })])
    expect(html).toMatch(/<div class="[^"]*gf-look[^"]*gf-stage[^"]*" data-ground="stage">/)
  })

  it("maps every step of the contract onto a token, never a number of its own", () => {
    for (const step of ["none", "small", "medium", "large"]) {
      expect(LOOK_CSS).toContain(`[data-outer="${step}"]`)
      expect(LOOK_CSS).toContain(`[data-inner="${step}"]`)
    }
    for (const ground of ["page", "well", "stage", "primary"]) {
      expect(LOOK_CSS).toContain(`[data-ground="${ground}"]`)
    }
    expect(LOOK_CSS).toContain('[data-align="center"]')
    expect(LOOK_CSS).toContain('[data-width="narrow"]')
    expect(LOOK_CSS).toContain('[data-width="full"]')
    expect(LOOK_CSS).not.toMatch(/:\s*[1-9]\d*px/)
  })
})
