import { describe, expect, it } from "vitest"
import type { StoreThemeSettings } from "@qticaret/types"
import {
  DEFAULT_THEME,
  THEME_BACKGROUNDS,
  themeFonts,
  themeSettings,
  themeStyle,
  themeView,
} from "../theme"

const theme = (patch: Partial<StoreThemeSettings>): StoreThemeSettings => ({
  ...DEFAULT_THEME,
  ...patch,
})

describe("themeSettings", () => {
  it("takes the backend's answer as it is when every field is a known choice", () => {
    const answer: StoreThemeSettings = {
      theme: "base",
      colors: { primary: "#0b5c99", accent: "#f5d90a", background: "cool" },
      typography: { heading: "playfair", body: "nunito" },
      radius: "round",
      product_card: { ratio: "1:1", show_brand: false, show_rating: true },
      header: { layout: "left", sticky: false },
      buttons: "square",
    }
    expect(themeSettings(answer, null)).toEqual(answer)
  })

  it("is today's look with no answer, the storefront section's colour kept (a backend before adr/0053)", () => {
    expect(themeSettings(undefined, null)).toEqual(DEFAULT_THEME)
    expect(themeSettings(undefined, "#0b5c99").colors.primary).toBe("#0b5c99")
  })

  it("lets nothing unknown through: CSS, an unknown face or a malformed colour fall back", () => {
    const settings = themeSettings(
      {
        colors: { primary: "red;}body{display:none", accent: "#FFF", background: "pink" },
        typography: { heading: "comic-sans", body: "url(https://fonts.example/x)" },
        radius: "blob",
        product_card: { ratio: "16:9", show_brand: "no", show_rating: 1 },
        header: { layout: "right", sticky: null },
        buttons: "circle",
        extra: "ignored",
      },
      null
    )
    expect(settings).toEqual(DEFAULT_THEME)
    expect(themeSettings("not an object", null)).toEqual(DEFAULT_THEME)
    expect(themeSettings({ colors: null }, null)).toEqual(DEFAULT_THEME)
  })
})

describe("themeStyle", () => {
  it("prints nothing at the defaults: the theme's own look stands", () => {
    expect(themeStyle(DEFAULT_THEME)).toBeNull()
  })

  it("gives the main colour to buttons, the ring and the announcement bar, with readable text", () => {
    expect(themeStyle(theme({ colors: { ...DEFAULT_THEME.colors, primary: "#0b5c99" } }))).toBe(
      ":root{--primary:#0b5c99;--primary-foreground:#ffffff;--ring:#0b5c99;" +
        "--announcement:#0b5c99;--announcement-foreground:#ffffff}"
    )
  })

  it("gives the accent to badges and highlights, ink or white on it by its lightness", () => {
    const style = themeStyle(theme({ colors: { ...DEFAULT_THEME.colors, accent: "#f5d90a" } }))
    expect(style).toBe(":root{--highlight:#f5d90a;--highlight-foreground:#111113}")
  })

  it("paints the page with the backend's values and the neutrals that go with it", () => {
    expect(THEME_BACKGROUNDS).toEqual({ warm: "#f6f4ef", neutral: "#f5f5f5", cool: "#f3f5f8" })
    const neutral = themeStyle(
      theme({ colors: { ...DEFAULT_THEME.colors, background: "neutral" } })
    )
    expect(neutral).toContain("--background:#f5f5f5;")
    expect(neutral).toContain("--muted-foreground:#585858")
    const cool = themeStyle(theme({ colors: { ...DEFAULT_THEME.colors, background: "cool" } }))
    expect(cool).toContain("--background:#f3f5f8;")
    expect(cool).toContain("--border:#dce1e8")
  })

  it("sets the faces through their own variables, each with a fallback of its kind", () => {
    const style = themeStyle(theme({ typography: { heading: "dm-serif", body: "source-sans" } }))
    expect(style).toContain(
      '--font-heading:var(--font-dm-serif), ui-serif, Georgia, "Times New Roman", serif'
    )
    expect(style).toContain("--font-sans:var(--font-source-sans), ui-sans-serif")
    // Inter for headings is a sans face
    expect(themeStyle(theme({ typography: { heading: "inter", body: "inter" } }))).toBe(
      ':root{--font-heading:var(--font-inter), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif}'
    )
  })

  it("scales the corners, shapes the buttons and the cards' pictures", () => {
    expect(themeStyle(theme({ radius: "sharp" }))).toBe(":root{--radius-scale:0.2}")
    expect(themeStyle(theme({ radius: "round" }))).toBe(":root{--radius-scale:1.5}")
    expect(themeStyle(theme({ buttons: "rounded" }))).toBe(":root{--button-radius:0.75rem}")
    expect(themeStyle(theme({ buttons: "square" }))).toBe(":root{--button-radius:0}")
    expect(
      themeStyle(theme({ product_card: { ...DEFAULT_THEME.product_card, ratio: "3:4" } }))
    ).toBe(":root{--card-ratio:3 / 4}")
    expect(
      themeStyle(theme({ product_card: { ...DEFAULT_THEME.product_card, ratio: "1:1" } }))
    ).toBe(":root{--card-ratio:1 / 1}")
  })

  it("never closes its own rule: every value comes from a fixed list or a checked colour", () => {
    const style = themeStyle(
      themeSettings(
        { colors: { primary: "#000000;}*{x:y", accent: "#0b5c99}" }, radius: "sharp" },
        null
      )
    )
    expect(style).toBe(":root{--radius-scale:0.2}")
  })
})

describe("themeView and themeFonts", () => {
  it("hands the theme the choices that change markup", () => {
    expect(themeView(DEFAULT_THEME)).toEqual({
      card: { ratio: "4:5", showBrand: true, showRating: false },
      header: { layout: "centered", sticky: true },
      buttons: "pill",
    })
    expect(
      themeView(
        theme({
          header: { layout: "left", sticky: false },
          product_card: { ratio: "1:1", show_brand: false, show_rating: true },
        })
      )
    ).toMatchObject({
      card: { ratio: "1:1", showBrand: false, showRating: true },
      header: { layout: "left", sticky: false },
    })
  })

  it("names the faces whose classes go on <html>, once each", () => {
    expect(themeFonts(DEFAULT_THEME)).toEqual(["fraunces", "inter"])
    expect(themeFonts(theme({ typography: { heading: "manrope", body: "manrope" } }))).toEqual([
      "manrope",
    ])
  })
})
