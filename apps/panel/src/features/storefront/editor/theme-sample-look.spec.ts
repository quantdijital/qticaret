import { describe, expect, it } from "vitest"
import { GRAFIT_VALUES } from "@/features/storefront/theme-settings"
import type { ThemeValues } from "@/features/storefront/theme-settings"
import { ATOLYE_COLORS, ATOLYE_TONES } from "@/theme/atolye"
import { STOREFRONT_BACKGROUNDS } from "@/theme/storefront"
import { sampleLook } from "./theme-sample-look"

const g = GRAFIT_VALUES
const look = (patch: Partial<ThemeValues>) => sampleLook({ ...g, ...patch })

describe("what the sample paints for the form's choices (adr/0062 §12)", () => {
  it("is Grafit with nothing chosen: steel, the theme's wine, graphite marks, pills, a square card", () => {
    expect(sampleLook(g)).toMatchObject({
      page: "#f8fafc",
      well: ATOLYE_TONES.steel.well,
      field: ATOLYE_TONES.steel.field,
      bar: { background: ATOLYE_COLORS.stage, color: ATOLYE_COLORS.stageText },
      primary: ATOLYE_COLORS.wine,
      primaryText: "#ffffff",
      ownPrimary: true,
      mark: ATOLYE_COLORS.text,
      markText: "#f8fafc",
      note: `color-mix(in oklab, ${ATOLYE_COLORS.wine} 9%, #f8fafc)`,
      corners: { tile: 20, media: 14, inner: 10 },
      control: "999px",
      pill: "999px",
      ratio: "1 / 1",
      headingWeight: 800,
      showBrand: true,
      showRating: false,
    })
  })

  it("puts the shop's main colour on buttons and links, never on the announcement bar", () => {
    const own = look({ colors: { ...g.colors, primary: "#ffd400" } })
    expect(own).toMatchObject({ primary: "#ffd400", primaryText: "#111113", ownPrimary: false })
    expect(own.bar).toEqual(sampleLook(g).bar)
    // With no accent a note is tinted with the main colour; marks stay graphite
    expect(own.note).toContain("#ffd400 9%")
    expect(own.mark).toBe(ATOLYE_COLORS.text)
    // A colour still being typed paints nothing: the theme's own shows
    expect(look({ colors: { ...g.colors, primary: "#0b5c" } }).primary).toBe(ATOLYE_COLORS.wine)
  })

  it("puts the accent on the selected chip and in a note's ground, not on buttons", () => {
    const accented = look({ colors: { ...g.colors, accent: "#c2410c" } })
    expect(accented).toMatchObject({
      mark: "#c2410c",
      markText: "#ffffff",
      primary: ATOLYE_COLORS.wine,
    })
    expect(accented.note).toBe("color-mix(in oklab, #c2410c 9%, #f8fafc)")
    expect(look({ colors: { ...g.colors, accent: "#ffd400" } }).markText).toBe("#111113")
  })

  it("paints each page colour with its own well and field", () => {
    for (const background of ["steel", "warm", "neutral", "cool"] as const) {
      const toned = look({ colors: { ...g.colors, background } })
      expect(toned.page).toBe(STOREFRONT_BACKGROUNDS[background])
      expect(toned.well).toBe(ATOLYE_TONES[background].well)
      expect(toned.field).toBe(ATOLYE_TONES[background].field)
      // A graphite mark's text is the page itself
      expect(toned.markText).toBe(STOREFRONT_BACKGROUNDS[background])
      expect(toned.bar.background).toBe(ATOLYE_COLORS.stage)
    }
  })

  it("scales the theme's 20 / 14 / 10 px corners, and leaves pills alone", () => {
    expect(look({ radius: "sharp" }).corners).toEqual({ tile: 4, media: 2.8, inner: 2 })
    expect(look({ radius: "round" }).corners).toEqual({ tile: 30, media: 21, inner: 15 })
    expect(look({ radius: "sharp" })).toMatchObject({ control: "999px", pill: "999px" })
  })

  it("shapes buttons and fields by the button choice while chips stay pills", () => {
    expect(look({ buttons: "rounded" })).toMatchObject({ control: "0.75rem", pill: "999px" })
    expect(look({ buttons: "square" })).toMatchObject({ control: "0px", pill: "999px" })
    // The corner choice is another setting
    expect(look({ buttons: "square" }).corners).toEqual({ tile: 20, media: 14, inner: 10 })
  })

  it("draws the card at the chosen shape with the brand and the rating as chosen", () => {
    const card = (product_card: ThemeValues["product_card"]) => look({ product_card })
    expect(card({ ratio: "4:5", show_brand: false, show_rating: true })).toMatchObject({
      ratio: "4 / 5",
      showBrand: false,
      showRating: true,
    })
    expect(card({ ...g.product_card, ratio: "3:4" }).ratio).toBe("3 / 4")
  })

  it("draws a face the panel has loaded and names the ones it has not", () => {
    // Manrope is the storefront's file: a system sans stands in, and the sample says so
    const grafit = sampleLook(g)
    expect(grafit.heading).toMatchObject({ font: "manrope", loaded: false })
    expect(grafit.heading.family).toMatch(/^ui-sans-serif/)
    expect(grafit.unloaded).toEqual(["manrope"])

    // Inter is the panel's own face
    const inter = look({ typography: { heading: "inter", body: "inter" } })
    expect(inter.heading).toMatchObject({ loaded: true })
    expect(inter.body.family).toMatch(/^"Inter Variable", ui-sans-serif/)
    expect(inter.unloaded).toEqual([])

    // A serif heading falls back to a serif, never to the panel's sans
    const serif = look({ typography: { heading: "playfair", body: "nunito" } })
    expect(serif.heading.family).toMatch(/^ui-serif/)
    expect(serif.body.family).toMatch(/^ui-sans-serif/)
    expect(serif.unloaded).toEqual(["playfair", "nunito"])
  })

  it("sets headings heavy, except in the face that has one weight", () => {
    expect(look({ typography: { heading: "fraunces", body: "inter" } }).headingWeight).toBe(800)
    expect(look({ typography: { heading: "dm-serif", body: "inter" } }).headingWeight).toBe(400)
  })
})
