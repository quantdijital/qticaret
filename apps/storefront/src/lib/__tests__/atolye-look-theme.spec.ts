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

  it("keeps a sale readable on each ground and the sale badge in the deal's red", () => {
    // The stage lifts only the sale price (`ui.css`'s `.gf-stage .text-deal`): the badge is `bg-deal`
    expect(LOOK_CSS).not.toContain("--color-deal:")
    expect(LOOK_CSS).toMatch(
      /\.gf-look\[data-ground="primary"\] \.text-deal \{\s*color: var\(--primary-foreground\);/
    )
  })

  it("trades the two papers in the well, so a chip on a tile still shows", () => {
    expect(LOOK_CSS).toMatch(
      /--color-paper: var\(--look-well\);\s*--color-paper-2: var\(--look-page\);/
    )
  })
})

/** docs/tema/bilesen-standardi §2: which screens show a section, hidden with CSS at 64rem. */
describe("the screens a section shows on in Atölye", () => {
  it("puts them on a box that draws nothing, or on the look's box when there is one", () => {
    const plain = home([{ ...faq("sss1"), device: "mobile" }])
    expect(plain).toContain('<div class="gf-device" data-show-on="mobile">')
    expect(plain).not.toContain("gf-look")

    const looked = home([{ ...faq("sss1", { ground: "well" }), device: "desktop" }])
    expect(looked).toMatch(/<div class="[^"]*gf-look[^"]*"[^>]*data-show-on="desktop"/)
    expect(looked).not.toContain("gf-device")

    expect(home([faq("sss1")])).not.toContain("data-show-on")
  })

  it("hides each at the theme's frame breakpoint, the plain box drawing nothing", () => {
    expect(LOOK_CSS).toMatch(/\.gf-device \{\s*display: contents;/)
    expect(LOOK_CSS).toMatch(
      /@media \(width >= 64rem\) \{\s*\[data-show-on="mobile"\] \{\s*display: none;/
    )
    expect(LOOK_CSS).toMatch(
      /@media \(width < 64rem\) \{\s*\[data-show-on="desktop"\] \{\s*display: none;/
    )
  })
})
