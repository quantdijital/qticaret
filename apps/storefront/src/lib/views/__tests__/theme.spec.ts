import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { StoreThemeSettings } from "@qticaret/types"
import { DEFAULT_THEME, THEME_BACKGROUNDS, themeSettings, themeStyle, themeView } from "../theme"

const theme = (patch: Partial<StoreThemeSettings>): StoreThemeSettings => ({
  ...DEFAULT_THEME,
  ...patch,
})

/** `oklch(L% C H)` as `#rrggbb` (CSS Color 4: OKLCH → OKLab → linear sRGB → gamma, 8-bit). */
function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const L = lightness / 100
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  const channels = linear.map((value) => {
    const clipped = Math.min(1, Math.max(0, value))
    const gamma = clipped <= 0.0031308 ? 12.92 * clipped : 1.055 * clipped ** (1 / 2.4) - 0.055
    return Math.round(gamma * 255)
      .toString(16)
      .padStart(2, "0")
  })
  return `#${channels.join("")}`
}

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
      product_card: { ratio: "1:1", show_brand: false, show_rating: true },
      header: { layout: "left", sticky: false },
      buttons: "square",
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
      product_card: { ratio: "1:1", show_brand: true, show_rating: false },
      header: { layout: "left", sticky: true },
      buttons: "pill",
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

  it("paints the page with the backend's values and the neutrals that go with it", () => {
    expect(THEME_BACKGROUNDS).toEqual({
      steel: "#f8fafc",
      warm: "#f6f4ef",
      neutral: "#f5f5f5",
      cool: "#f3f5f8",
    })
    const warm = themeStyle(theme({ colors: { ...DEFAULT_THEME.colors, background: "warm" } }))
    expect(warm).toContain("--background:#f6f4ef;")
    expect(warm).toContain("--muted-foreground:#5c574d")
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
    expect(themeStyle(theme({ typography: { heading: "manrope", body: "manrope" } }))).toBeNull()
    expect(style).toContain(
      '--font-heading:var(--font-dm-serif), ui-serif, Georgia, "Times New Roman", serif'
    )
    expect(style).toContain("--font-sans:var(--font-source-sans), ui-sans-serif")
    // Inter for headings is a sans face
    expect(themeStyle(theme({ typography: { heading: "inter", body: "manrope" } }))).toBe(
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
    })
    expect(
      themeView(
        theme({
          header: { layout: "centered", sticky: false },
          product_card: { ratio: "4:5", show_brand: false, show_rating: true },
        })
      )
    ).toMatchObject({
      card: { ratio: "4:5", showBrand: false, showRating: true },
      header: { layout: "centered", sticky: false },
    })
  })
})
