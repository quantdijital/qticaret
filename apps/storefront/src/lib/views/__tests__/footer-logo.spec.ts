import { describe, expect, it } from "vitest"
import type { StoreMainSections } from "@qticaret/types"
import { footerLogoOf } from "../footer-logo"
import { footerBarOf } from "../main-sections"

/**
 * The footer named by the store profile's logo (owner 2026-11-16: "header
 * logosuyla bağlansın işte"): no setting, the header's source, the light
 * ground logo first, the dark one when it is the only one, the name
 * whenever there is no logo.
 */

const t = (key: string) => key

const logo = (url: string, width: number | null = 240, height: number | null = 60) => ({
  url,
  width,
  height,
})

const footer = (more: Record<string, unknown>) =>
  ({
    footer_bar: { id: "mainfooter", type: "footer_bar", variant: "ledger", ...more },
  }) as unknown as StoreMainSections

describe("the footer's logo (owner 2026-11-16)", () => {
  it("takes the light-ground logo with its size, alt the shop's name", () => {
    expect(
      footerLogoOf({
        name: "Bıçakçı",
        logo_url: "/m/acik.svg",
        logos: { light: logo("/m/acik.svg"), dark: logo("/m/koyu.svg") },
      })
    ).toEqual({
      src: "/m/acik.svg",
      alt: "Bıçakçı",
      width: 240,
      height: 60,
      sources: { avif: null, webp: null },
    })
  })

  it("falls to the dark-ground logo when the shop has only that, and to none without either", () => {
    expect(
      footerLogoOf({ name: "B", logo_url: null, logos: { light: null, dark: logo("/m/koyu.png") } })
        ?.src
    ).toBe("/m/koyu.png")
    expect(footerLogoOf({ name: "B", logo_url: null, logos: { light: null, dark: null } })).toBe(
      null
    )
  })

  it("reads a backend before the two logos by the one address, size unknown", () => {
    expect(footerLogoOf({ name: "B", logo_url: "/m/eski.png" })).toMatchObject({
      src: "/m/eski.png",
      width: null,
      height: null,
    })
    expect(footerLogoOf({ name: "B", logo_url: null })).toBeNull()
  })

  it("keeps an unmeasured or odd size out", () => {
    const view = footerLogoOf({
      name: "B",
      logo_url: "/m/a.svg",
      logos: { light: logo("/m/a.svg", null, 0), dark: null },
    })
    expect([view?.width, view?.height]).toEqual([null, null])
  })
})

describe("the footer bar with the shop's logo (owner 2026-11-16)", () => {
  const image = footerLogoOf({ name: "B", logo_url: "/m/a.svg" })

  it("carries the logo whenever the shop has one, with no setting of its own", () => {
    expect(footerBarOf(footer({}), t, image)).toEqual({
      id: "mainfooter",
      variant: "ledger",
      logo: image,
    })
    expect(footerBarOf(undefined, t, image)).toMatchObject({ logo: image })
  })

  it("carries none without a logo: the footer writes the name as before", () => {
    expect(footerBarOf(footer({}), t, null)).toEqual({ id: "mainfooter", variant: "ledger" })
    expect(footerBarOf(footer({}), t)).toEqual({ id: "mainfooter", variant: "ledger" })
  })
})
