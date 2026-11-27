import { describe, expect, it } from "vitest"
import { headerLogoOnDarkOf } from "../footer-logo"

/**
 * The header's logo over the opening's photograph (as Shopify's "logo for
 * transparent header"): the shop's dark-ground logo, only when it is its
 * own file; otherwise none and the theme lightens the header's logo as before.
 */

const logo = (url: string, width: number | null = 240, height: number | null = 60) => ({
  url,
  width,
  height,
})

describe("the header's logo over the photograph", () => {
  it("is the dark-ground logo with its size and an empty alt (the link names the shop)", () => {
    expect(
      headerLogoOnDarkOf({
        name: "Rota",
        logo_url: "/m/acik.png",
        logos: { light: logo("/m/acik.png"), dark: logo("/m/koyu.png", 480.4, 120) },
      })
    ).toEqual({
      src: "/m/koyu.png",
      alt: "",
      width: 480,
      height: 120,
      sources: { avif: null, webp: null },
    })
  })

  it("is none when the dark-ground logo is the same file, absent, or the header has no logo", () => {
    expect(
      headerLogoOnDarkOf({
        name: "R",
        logo_url: "/m/a.png",
        logos: { light: logo("/m/a.png"), dark: logo("/m/a.png") },
      })
    ).toBe(null)
    expect(
      headerLogoOnDarkOf({
        name: "R",
        logo_url: "/m/a.png",
        logos: { light: logo("/m/a.png"), dark: null },
      })
    ).toBe(null)
    expect(
      headerLogoOnDarkOf({
        name: "R",
        logo_url: null,
        logos: { light: null, dark: logo("/m/k.png") },
      })
    ).toBe(null)
    // A backend before the two logos
    expect(headerLogoOnDarkOf({ name: "R", logo_url: "/m/a.png" })).toBe(null)
  })
})
