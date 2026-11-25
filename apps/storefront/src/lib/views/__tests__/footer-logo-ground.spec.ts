import { describe, expect, it } from "vitest"
import type { StoreMainSections } from "@qticaret/types"
import { footerLogoOf, footerLogosOf } from "../footer-logo"
import { footerBarOf } from "../main-sections"
import type { FreeRowsParts } from "../main-sections"

/**
 * The footer's logo on its ground (bug, 2026-11-25): a footer on the dark
 * stage (Patika's free rows, Rota's brand columns) drew the light-ground
 * logo, which did not read there. On a dark ground the store profile's
 * dark-ground logo, the light one when the shop has only that; on a light
 * ground as before.
 */

const t = (key: string) => key

const logo = (url: string) => ({ url, width: 240, height: 60 })

const SHOP = {
  name: "Patika",
  logo_url: "/m/acik.svg",
  logos: { light: logo("/m/acik.svg"), dark: logo("/m/koyu.svg") },
}

const src = (view: { src: string } | null | undefined) => view?.src ?? null

const bar = (more: Record<string, unknown>) =>
  ({
    footer_bar: { id: "mainfooter", type: "footer_bar", ...more },
  }) as unknown as StoreMainSections

const PARTS: FreeRowsParts = {
  menus: [],
  contact: {
    email: null,
    phone: null,
    phoneHref: null,
    whatsappHref: null,
    address: null,
    hours: [],
    mapHref: null,
  },
  social: [],
  name: "Patika",
  title: "Patika",
  trustBadges: [],
  payments: [],
  carriers: [],
}

const brandRow = (id: string, ground: string) => ({
  id,
  layout: "1",
  ground,
  columns: [{ blocks: [{ id: `${id}b`, at: 0, device: "all", type: "brand", logo: true }] }],
})

describe("the footer's logo by its ground (2026-11-25)", () => {
  it("takes the dark-ground logo on a dark ground, the light one when the shop has only that", () => {
    expect(src(footerLogoOf(SHOP, "dark"))).toBe("/m/koyu.svg")
    expect(src(footerLogoOf(SHOP, "light"))).toBe("/m/acik.svg")
    expect(src(footerLogoOf(SHOP))).toBe("/m/acik.svg")
    const lightOnly = { ...SHOP, logos: { light: logo("/m/acik.svg"), dark: null } }
    expect(src(footerLogoOf(lightOnly, "dark"))).toBe("/m/acik.svg")
    // A backend before the two logos: the one address on either ground
    expect(src(footerLogoOf({ name: "B", logo_url: "/m/eski.png" }, "dark"))).toBe("/m/eski.png")
  })

  it("reads the main colour as a ground: dark when white text reads on it, the theme's own too", () => {
    expect(src(footerLogosOf(SHOP, null).primary)).toBe("/m/koyu.svg")
    expect(src(footerLogosOf(SHOP, "#1f3d2b").primary)).toBe("/m/koyu.svg")
    expect(src(footerLogosOf(SHOP, "#f2d64b").primary)).toBe("/m/acik.svg")
  })

  it("names the brand columns footer with the dark-ground logo on the stage only", () => {
    const logos = footerLogosOf(SHOP, null)
    const columns = (ground: string) =>
      footerBarOf(bar({ variant: "brand_columns", columns: { ground } }), t, logos)
    expect(src(columns("stage").logo)).toBe("/m/koyu.svg")
    expect(src(columns("well").logo)).toBe("/m/acik.svg")
    expect(src(columns("page").logo)).toBe("/m/acik.svg")
    // The ledger stands on the light well whatever is stored
    expect(src(footerBarOf(bar({ variant: "ledger", ground: "stage" }), t, logos).logo)).toBe(
      "/m/acik.svg"
    )
  })

  it("gives each free row's brand block the logo for the ground that row stands on", () => {
    const logos = footerLogosOf(SHOP, "#f2d64b")
    const rows = [
      brandRow("inherit1", "inherit"),
      brandRow("stage001", "stage"),
      brandRow("well0001", "well"),
      brandRow("page0001", "page"),
      brandRow("primary1", "primary"),
    ]
    const drawn = (ground: string) => {
      const view = footerBarOf(bar({ variant: "free_rows", ground, rows }), t, logos, PARTS)
      return {
        bar: src(view.logo),
        rows: (view.rows ?? []).map((row) => {
          const [block] = row.columns[0]?.blocks ?? []
          return block?.type === "brand" ? src(block.logo) : "none"
        }),
      }
    }
    // Patika's: the footer on the stage, a row on its ground dark too
    expect(drawn("stage")).toEqual({
      bar: "/m/koyu.svg",
      rows: ["/m/koyu.svg", "/m/koyu.svg", "/m/acik.svg", "/m/acik.svg", "/m/acik.svg"],
    })
    // The light well: only a row on the stage turns dark (a light main colour stays light)
    expect(drawn("well")).toEqual({
      bar: "/m/acik.svg",
      rows: ["/m/acik.svg", "/m/koyu.svg", "/m/acik.svg", "/m/acik.svg", "/m/acik.svg"],
    })
  })

  it("draws as before for a shop with one logo or none", () => {
    const one = footerLogosOf({ name: "B", logo_url: "/m/tek.png" }, null)
    expect([one.light, one.dark, one.primary].map(src)).toEqual([
      "/m/tek.png",
      "/m/tek.png",
      "/m/tek.png",
    ])
    const none = footerLogosOf({ name: "B", logo_url: null }, null)
    expect(
      footerBarOf(bar({ variant: "brand_columns", columns: { ground: "stage" } }), t, none)
    ).not.toHaveProperty("logo")
  })
})
