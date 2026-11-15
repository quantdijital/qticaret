import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { StoreThemeSettings } from "@qticaret/types"
import { oklchToHex } from "@/test/colour"
import {
  DEFAULT_THEME,
  THEME_BACKGROUNDS,
  THEME_FONTS,
  themeSettings,
  themeStyle,
  themeView,
} from "../theme"

const theme = (patch: Partial<StoreThemeSettings>): StoreThemeSettings => ({
  ...DEFAULT_THEME,
  ...patch,
})

/** The Atölye theme's page token as its stylesheet declares it. */
function paperToken(): [number, number, number] {
  const tokens = readFileSync(
    fileURLToPath(
      new URL("../../../../../../packages/themes/atolye/src/tokens.css", import.meta.url)
    ),
    "utf8"
  )
  const found = /--color-paper:\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/.exec(tokens)
  if (!found) {
    throw new Error("tokens.css declares no oklch --color-paper")
  }
  return [Number(found[1]), Number(found[2]), Number(found[3])]
}

describe("themeSettings", () => {
  it("takes the backend's answer as it is when every field is a known choice", () => {
    const answer: StoreThemeSettings = {
      theme: "atolye",
      colors: { primary: "#0b5c99", accent: "#f5d90a", background: "cool" },
      typography: { heading: "playfair", body: "nunito" },
      radius: "round",
      product_card: {
        ratio: "1:1",
        show_brand: false,
        show_rating: true,
        variant: "framed",
        hover_image: false,
        delivery_note: true,
        full_button: false,
        sale_badge: false,
        low_stock_badge: true,
        sold_out_badge: false,
        sold_out_row: "notify",
        no_reviews: "write_first",
        button_style: "text",
      },
      header: { layout: "left", sticky: false },
      buttons: "square",
      section_spacing: "compact",
      surface_style: "lined",
    }
    expect(themeSettings(answer, null)).toEqual(answer)
  })

  it("is today's look with no answer, the storefront section's colour kept (a backend before adr/0053)", () => {
    // Grafit, as the backend's `themeSection` starts (adr/0062 §2)
    expect(DEFAULT_THEME).toEqual({
      theme: "atolye",
      colors: { primary: null, accent: null, background: "steel" },
      typography: { heading: "manrope", body: "manrope" },
      radius: "soft",
      product_card: {
        ratio: "1:1",
        show_brand: true,
        show_rating: false,
        variant: "standard",
        hover_image: true,
        delivery_note: true,
        full_button: true,
        sale_badge: true,
        low_stock_badge: true,
        sold_out_badge: true,
        sold_out_row: "price",
        no_reviews: "hide",
        button_style: "outline",
      },
      header: { layout: "left", sticky: true },
      buttons: "pill",
      section_spacing: "normal",
      surface_style: "filled",
    })
    expect(themeSettings(undefined, null)).toEqual(DEFAULT_THEME)
    expect(themeSettings(undefined, "#0b5c99").colors.primary).toBe("#0b5c99")
  })

  it("lets nothing unknown through: CSS, an unknown face or a malformed colour fall back", () => {
    const settings = themeSettings(
      {
        colors: { primary: "red;}body{display:none", accent: "#FFF", background: "pink" },
        typography: { heading: "comic-sans", body: "url(https://fonts.example/x)" },
        radius: "blob",
        product_card: {
          ratio: "16:9",
          show_brand: "no",
          show_rating: 1,
          variant: "technical",
          hover_image: "yes",
          empty_stars: null,
          sale_badge: "no",
          sold_out_row: "hidden",
          no_reviews: "stars",
          button_style: "ghost",
        },
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

  it("reads a backend before the no-reviews choice by the framed card's empty stars switch", () => {
    const old = (empty_stars: unknown, variant = "framed") =>
      themeSettings({ product_card: { show_rating: true, variant, empty_stars } }, null)
        .product_card.no_reviews
    expect(old(true)).toBe("empty_stars")
    expect(old(false)).toBe("hide")
    // The switch drew only on the framed card: another's saved look does not change
    expect(old(true, "standard")).toBe("hide")
    expect(old(true, "technical")).toBe("hide")
    expect(
      themeSettings({ product_card: { empty_stars: true } }, null).product_card.no_reviews
    ).toBe("hide")
    expect(
      themeSettings({ product_card: { empty_stars: true, no_reviews: "write_first" } }, null)
        .product_card.no_reviews
    ).toBe("write_first")
  })

  it("leaves the section's own version out: it is not a choice", () => {
    expect(themeSettings({ ...DEFAULT_THEME, settings_version: 2 }, null)).toEqual(DEFAULT_THEME)
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

  it("holds steel as the theme's own page token in sRGB (adr/0062 §3)", () => {
    const [lightness, chroma, hue] = paperToken()
    expect([lightness, chroma, hue]).toEqual([98.4, 0.003, 250])
    expect(THEME_BACKGROUNDS.steel).toBe(oklchToHex(lightness, chroma, hue))
    // The converter itself, on colours known in both forms
    expect(oklchToHex(100, 0, 0)).toBe("#ffffff")
    expect(oklchToHex(0, 0, 0)).toBe("#000000")
    expect(oklchToHex(62.8, 0.2577, 29.23)).toBe("#ff0000")
  })

  it("holds the page colours as the backend's check reads them, and leaves painting a tone to the theme", () => {
    expect(THEME_BACKGROUNDS).toEqual({
      steel: "#f8fafc",
      warm: "#f6f4ef",
      neutral: "#f5f5f5",
      cool: "#f3f5f8",
    })
    // A theme prints its own surfaces for a tone (adr/0062 §5), handed in as `own`
    for (const background of ["steel", "warm", "neutral", "cool"] as const) {
      expect(themeStyle(theme({ colors: { ...DEFAULT_THEME.colors, background } }))).toBeNull()
    }
    expect(
      themeStyle(theme({ colors: { ...DEFAULT_THEME.colors, background: "warm" } }), [
        "--color-paper:#f6f4ef",
      ])
    ).toBe(":root{--color-paper:#f6f4ef}")
    expect(themeStyle(theme({ radius: "sharp" }), ["--x:1", "--y:2"])).toBe(
      ":root{--radius-scale:0.2;--x:1;--y:2}"
    )
    expect(themeStyle(DEFAULT_THEME, [])).toBeNull()
  })

  it("sets the faces through their own variables, each with a fallback of its kind", () => {
    const style = themeStyle(theme({ typography: { heading: "playfair", body: "source-sans" } }))
    expect(themeStyle(theme({ typography: { heading: "manrope", body: "manrope" } }))).toBeNull()
    expect(style).toContain(
      '--font-heading:var(--font-playfair), ui-serif, Georgia, "Times New Roman", serif'
    )
    expect(style).toContain("--font-sans:var(--font-source-sans), ui-sans-serif")
    // Inter for headings is a sans face
    expect(themeStyle(theme({ typography: { heading: "inter", body: "manrope" } }))).toBe(
      ':root{--font-heading:var(--font-inter), ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif}'
    )
  })

  it("prints every face the lists offer, and only the one that is not Manrope", () => {
    for (const heading of ["fraunces", "inter", "playfair", "dm-serif"] as const) {
      const style = themeStyle(theme({ typography: { heading, body: "manrope" } }))
      expect(style).toContain(`--font-heading:var(${THEME_FONTS[heading].variable}), `)
      expect(style).not.toContain("--font-sans")
    }
    for (const body of ["inter", "source-sans", "nunito"] as const) {
      const style = themeStyle(theme({ typography: { heading: "manrope", body } }))
      expect(style).toContain(`--font-sans:var(${THEME_FONTS[body].variable}), `)
      expect(style).not.toContain("--font-heading")
    }
  })

  it("sets a heading's weight to what its face carries: 400 for DM Serif, 800 (unprinted) for the rest", () => {
    expect(themeStyle(theme({ typography: { heading: "dm-serif", body: "manrope" } }))).toBe(
      ':root{--font-heading:var(--font-dm-serif), ui-serif, Georgia, "Times New Roman", serif;' +
        "--display-weight:400}"
    )
    for (const heading of ["fraunces", "inter", "playfair", "manrope"] as const) {
      expect(THEME_FONTS[heading].displayWeight).toBe(800)
      expect(themeStyle(theme({ typography: { heading, body: "manrope" } })) ?? "").not.toContain(
        "--display-weight"
      )
    }
    // Each face's file carries the weight its headings ask for (`app/fonts.css`)
    const css = readFileSync(
      fileURLToPath(new URL("../../../app/fonts.css", import.meta.url)),
      "utf8"
    )
    for (const [font, { variable, displayWeight }] of Object.entries(THEME_FONTS)) {
      const family = `qt-${variable.replace("--font-", "")}`
      const range = new RegExp(
        `font-family: "${family}";\\s+font-style: normal;\\s+font-weight: (\\d+)(?: (\\d+))?;`
      ).exec(css)
      const [lightest, heaviest] = [Number(range?.[1]), Number(range?.[2] ?? range?.[1])]
      expect(displayWeight >= lightest && displayWeight <= heaviest, font).toBe(true)
      expect(displayWeight, font).toBe(Math.min(800, heaviest))
    }
  })

  it("scales the corners, shapes the buttons and the cards' pictures", () => {
    expect(themeStyle(theme({ radius: "sharp" }))).toBe(":root{--radius-scale:0.2}")
    expect(themeStyle(theme({ radius: "round" }))).toBe(":root{--radius-scale:1.5}")
    expect(themeStyle(theme({ buttons: "rounded" }))).toBe(":root{--button-radius:0.75rem}")
    // With its unit: the theme compares it with a length in `min()`
    expect(themeStyle(theme({ buttons: "square" }))).toBe(":root{--button-radius:0px}")
    expect(themeStyle(theme({ radius: "soft", buttons: "pill" }))).toBeNull()
    expect(
      themeStyle(theme({ product_card: { ...DEFAULT_THEME.product_card, ratio: "3:4" } }))
    ).toBe(":root{--card-ratio:3 / 4}")
    // 4:5 used to print nothing and was drawn square (adr/0062 §9)
    expect(
      themeStyle(theme({ product_card: { ...DEFAULT_THEME.product_card, ratio: "4:5" } }))
    ).toBe(":root{--card-ratio:4 / 5}")
    expect(
      themeStyle(theme({ product_card: { ...DEFAULT_THEME.product_card, ratio: "1:1" } }))
    ).toBeNull()
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

describe("themeView", () => {
  it("hands the theme the choices that change markup", () => {
    expect(themeView(DEFAULT_THEME)).toEqual({
      card: { ratio: "1:1", showBrand: true, showRating: false },
      header: { layout: "left", sticky: true },
      buttons: "pill",
      surface: "filled",
    })
    expect(themeView(theme({ surface_style: "lined" })).surface).toBe("lined")
    expect(
      themeView(
        theme({
          header: { layout: "centered", sticky: false },
          product_card: {
            ...DEFAULT_THEME.product_card,
            ratio: "4:5",
            show_brand: false,
            show_rating: true,
          },
        })
      )
    ).toMatchObject({
      card: { ratio: "4:5", showBrand: false, showRating: true },
      header: { layout: "centered", sticky: false },
    })
  })
})
