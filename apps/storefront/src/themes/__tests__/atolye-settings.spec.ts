import { describe, expect, it } from "vitest"
import { ATOLYE_TONES, TONE_SURFACES } from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import { DEFAULT_THEME, THEME_FONTS, themeSettings } from "@/lib/views/theme"
import { atolyeCss, declared, ruleBody } from "@/test/atolye-css"
import { atolyeDeclarations, entry } from "../atolye"

const tokens = atolyeCss("tokens.css")
const contract = atolyeCss("styles.css")
const controls = atolyeCss("ui.css")

const chosen = (patch: Partial<StoreThemeSettings>): StoreThemeSettings => ({
  ...DEFAULT_THEME,
  ...patch,
})
const colours = (patch: Partial<StoreThemeSettings["colors"]>) =>
  chosen({ colors: { ...DEFAULT_THEME.colors, ...patch } })

/** A length token at a corner scale: `calc(20px * var(--radius-scale, 1))` → 20 at 1. */
function cornerAt(token: string, scale: number): number {
  const found = /^calc\((\d+)px \* var\(--radius-scale, 1\)\)$/.exec(declared(tokens, token))
  if (!found) {
    throw new Error(`${token} does not follow --radius-scale`)
  }
  return Math.round(Number(found[1]) * scale * 100) / 100
}

describe("Atölye at the defaults (Grafit, adr/0062 §2)", () => {
  it("prints nothing: no saved row, the defaults, and a row upgraded from before adr/0062", () => {
    expect(entry.style(DEFAULT_THEME)).toBeNull()
    expect(entry.style(themeSettings(undefined, null))).toBeNull()
    expect(atolyeDeclarations(DEFAULT_THEME)).toEqual([])
    // What the backend hands out for an old row (`upgradeStoredTheme`): Grafit, its main colour kept
    const upgraded = themeSettings(
      {
        ...DEFAULT_THEME,
        settings_version: 2,
        colors: { ...DEFAULT_THEME.colors, primary: "#7a1a48" },
      },
      null
    )
    expect(entry.style(upgraded)).toBe(
      ":root{--primary:#7a1a48;--primary-foreground:#ffffff;--ring:#7a1a48;" +
        "--announcement:#7a1a48;--announcement-foreground:#ffffff}"
    )
  })

  it("has the value each default setting stands for as the theme's own token", () => {
    // typography: manrope / manrope
    const manrope = `var(${THEME_FONTS[DEFAULT_THEME.typography.body].variable}), ui-sans-serif, system-ui, sans-serif`
    expect(declared(contract, "--font-sans")).toBe(manrope)
    expect(declared(contract, "--font-heading")).toBe(manrope)
    expect(declared(tokens, "--font-body")).toBe("var(--font-sans)")
    expect(declared(tokens, "--font-display")).toBe("var(--font-heading)")
    expect(declared(tokens, "--display-weight")).toBe(
      String(THEME_FONTS[DEFAULT_THEME.typography.heading].displayWeight)
    )
    // radius: soft is the scale at 1, today's 20 / 14 / 10 px
    expect(declared(contract, "--radius-scale")).toBe("1")
    expect(
      ["--radius-tile", "--radius-media", "--radius-inner"].map((token) => cornerAt(token, 1))
    ).toEqual([20, 14, 10])
    expect(declared(tokens, "--radius-pill")).toBe("999px")
    // buttons: pill
    expect(declared(contract, "--button-radius")).toBe("999px")
    // product_card.ratio: 1:1
    expect(declared(contract, "--card-ratio")).toBe("1 / 1")
    // colors.background: steel, the tokens' own surfaces
    for (const surface of TONE_SURFACES) {
      expect(declared(tokens, `--color-${surface}`)).toBe(ATOLYE_TONES.steel[surface])
    }
    // colors.accent: none, so highlights are the main colour and marks are graphite
    expect(declared(contract, "--highlight")).toBe("var(--color-signal)")
    expect(declared(contract, "--highlight-foreground")).toBe("var(--color-signal-ink)")
    expect(declared(tokens, "--color-signal")).toBe("var(--primary)")
    expect(declared(tokens, "--color-highlight-soft")).toBe(
      "color-mix(in oklab, var(--highlight) 9%, var(--color-paper))"
    )
    expect(declared(tokens, "--color-mark")).toBe("var(--color-text)")
    expect(declared(tokens, "--color-mark-ink")).toBe("var(--color-paper)")
    expect(declared(tokens, "--color-mark-deep")).toBe("var(--color-text-2)")
  })
})

describe("the settings Atölye takes (adr/0062 §1): every one of them", () => {
  it("prints the whole choice in one rule", () => {
    const style = entry.style({
      ...DEFAULT_THEME,
      colors: { primary: "#7a1a48", accent: "#ffcc00", background: "cool" },
      typography: { heading: "playfair", body: "nunito" },
      radius: "round",
      buttons: "square",
      product_card: { ...DEFAULT_THEME.product_card, ratio: "3:4" },
    })
    expect(style).toBe(
      ":root{--primary:#7a1a48;--primary-foreground:#ffffff;--ring:#7a1a48;" +
        "--announcement:#7a1a48;--announcement-foreground:#ffffff;" +
        "--highlight:#ffcc00;--highlight-foreground:#111113;" +
        '--font-heading:var(--font-playfair), ui-serif, Georgia, "Times New Roman", serif;' +
        "--font-sans:var(--font-nunito), ui-sans-serif, system-ui, -apple-system, " +
        '"Segoe UI", Roboto, Arial, sans-serif;' +
        "--radius-scale:1.5;--button-radius:0px;--card-ratio:3 / 4;" +
        "--color-paper:#f3f5f8;--color-paper-2:#e9ecf1;--color-paper-3:#dadfe6;" +
        "--color-field:#f7f8fa;--color-chip:#f4f6f8;--color-rule:#d4d8de;" +
        "--color-mark:#ffcc00;--color-mark-ink:#111113;" +
        "--color-mark-deep:color-mix(in oklab,#ffcc00 85%,#111113)}"
    )
  })

  it("paints each page tone with its own surfaces, steel with none", () => {
    expect(entry.style(colours({ background: "steel" }))).toBeNull()
    for (const background of ["warm", "neutral", "cool"] as const) {
      const tone = ATOLYE_TONES[background]
      expect(entry.style(colours({ background }))).toBe(
        `:root{${TONE_SURFACES.map((surface) => `--color-${surface}:${tone[surface]}`).join(";")}}`
      )
    }
    // The contract's page names follow the tokens, so nothing else is printed
    expect(declared(contract, "--background")).toBe("var(--color-paper)")
    expect(declared(contract, "--muted")).toBe("var(--color-paper-2)")
    expect(declared(contract, "--border")).toBe("var(--color-rule)")
    expect(declared(contract, "--card")).toBe("var(--color-field)")
  })

  it("scales the tile, media and inner corners with the corner choice, never the pill", () => {
    expect(entry.style(chosen({ radius: "soft" }))).toBeNull()
    expect(entry.style(chosen({ radius: "sharp" }))).toBe(":root{--radius-scale:0.2}")
    expect(entry.style(chosen({ radius: "round" }))).toBe(":root{--radius-scale:1.5}")
    const corners = (scale: number) =>
      ["--radius-tile", "--radius-media", "--radius-inner"].map((token) => cornerAt(token, scale))
    expect(corners(0.2)).toEqual([4, 2.8, 2])
    expect(corners(1.5)).toEqual([30, 21, 15])
    expect(declared(tokens, "--radius-pill")).not.toContain("--radius-scale")
  })

  it("shapes buttons, icon buttons, fields and tabs with the button choice; chips and counts stay pills", () => {
    expect(entry.style(chosen({ buttons: "pill" }))).toBeNull()
    expect(entry.style(chosen({ buttons: "rounded" }))).toBe(":root{--button-radius:0.75rem}")
    expect(entry.style(chosen({ buttons: "square" }))).toBe(":root{--button-radius:0px}")
    for (const control of [".gf-btn", ".gf-icon-btn", ".gf-field", ".gf-skip"]) {
      expect(ruleBody(controls, control), control).toContain("border-radius: var(--button-radius);")
    }
    for (const pill of [".gf-chip", ".gf-count"]) {
      expect(ruleBody(controls, pill), pill).toContain("border-radius: var(--radius-pill);")
    }
    // The shelf's tabs are controls: they take the button shape, pills by default (K-22)
    expect(ruleBody(atolyeCss("tabs.css"), ".gf-tab")).toContain(
      "border-radius: var(--button-radius, var(--radius-pill));"
    )
    // A box field (a textarea) keeps the inner corner, never rounder than the button
    expect(declared(tokens, "--radius-box")).toBe(
      "min(var(--button-radius, 999px), var(--radius-inner))"
    )
  })

  it("gives the accent to highlights and marks, with text that reads on it", () => {
    expect(entry.style(colours({ accent: null }))).toBeNull()
    expect(entry.style(colours({ accent: "#f5d90a" }))).toBe(
      ":root{--highlight:#f5d90a;--highlight-foreground:#111113;" +
        "--color-mark:#f5d90a;--color-mark-ink:#111113;" +
        "--color-mark-deep:color-mix(in oklab,#f5d90a 85%,#111113)}"
    )
    expect(entry.style(colours({ accent: "#0b5c99" }))).toContain(
      "--color-mark:#0b5c99;--color-mark-ink:#ffffff;"
    )
    // A selected chip and a checked shelf tab are filled with the mark
    expect(ruleBody(controls, '.gf-chip[aria-current="page"]')).toMatch(
      /background: var\(--color-mark\);\s+color: var\(--color-mark-ink\);/
    )
    expect(ruleBody(atolyeCss("tabs.css"), ".gf-tab:has(> input:checked)")).toMatch(
      /background: var\(--color-mark\);\s+color: var\(--color-mark-ink\);/
    )
    // The sale's and the stock's colours are fixed, and the announcement bar is graphite
    for (const fixed of ["--color-deal", "--color-ok", "--color-error", "--color-stage"]) {
      expect(declared(tokens, fixed), fixed).toMatch(/^oklch\(/)
    }
    expect(atolyeCss("frame/Announcement.tsx")).toContain("gf-stage")
    expect(atolyeCss("frame/Announcement.tsx")).not.toMatch(/highlight|bg-mark|bg-announcement/)
  })

  it("draws the controls in the button shape and the badges as pills, in the markup's classes", () => {
    const classes = (file: string) => atolyeCss(file)
    // Buttons, button-like links, the select, the file button and the quantity's pill and steps
    for (const [file, count] of [
      ["product/Quantity.tsx", 1],
      ["parts/Stepper.tsx", 1],
      ["parts/NumberInput.tsx", 1],
      ["listing/Pager.tsx", 1],
      ["frame/Aisle.tsx", 1],
      ["frame/WhatsApp.tsx", 1],
      ["product/AskOnWhatsApp.tsx", 1],
      ["sections/SliderControls.tsx", 3],
      ["account/AccountNav.tsx", 1],
    ] as const) {
      expect(classes(file).split("rounded-button").length - 1, file).toBe(count)
    }
    expect(classes("product/Forms.tsx")).toContain("file:rounded-button")
    expect(classes("product/ReviewList.tsx")).toMatch(/appearance-none rounded-button border/)
    // Box fields: the inner corner, capped by the button shape
    for (const file of ["product/Forms.tsx", "product/Extras.tsx", "order/ReturnForm.tsx"]) {
      expect(classes(file), file).toMatch(/gf-field[^"]* rounded-box/)
      expect(classes(file), file).not.toMatch(/gf-field[^"]* rounded-inner/)
    }
    // Badges, option chips and counts: pills whatever the shape
    for (const file of [
      "parts/card-parts.tsx",
      "product/Price.tsx",
      "product/Options.tsx",
      "product/InstallmentPlans.tsx",
      "account/Orders.tsx",
    ]) {
      expect(classes(file), file).toContain("rounded-pill")
      expect(classes(file), file).not.toContain("rounded-button")
    }
  })

  it("fills selected chips, the filters' count and active filter chips with the mark; notes with the soft highlight", () => {
    for (const file of ["product/Options.tsx", "product/InstallmentPlans.tsx"]) {
      expect(atolyeCss(file), file).toContain("has-[:checked]:bg-mark has-[:checked]:text-mark-ink")
    }
    for (const file of [
      "listing/Toolbar.tsx",
      "product/ReviewList.tsx",
      "content/ReviewsPage.tsx",
    ]) {
      expect(atolyeCss(file), file).toMatch(
        /rounded-pill bg-mark pr-3 pl-4[^"]* text-mark-ink [^"]*hover:bg-mark-deep/
      )
    }
    expect(atolyeCss("listing/Toolbar.tsx")).toContain("rounded-pill bg-mark px-2")
    expect(atolyeCss("account/BillingForm.tsx")).toContain('"bg-mark text-mark-ink"')
    // The sale badge and the stock badges on a card keep their fixed colours
    // (`card-parts.tsx`: both card variants draw the same pills)
    const card = atolyeCss("parts/card-parts.tsx")
    expect(card).toContain("rounded-pill bg-deal px-2 py-1 text-deal-ink")
    expect(card).not.toMatch(/bg-mark|highlight/)
    expect(atolyeCss("product/Price.tsx")).toContain("bg-deal")
    // No component still reads the main colour's tint for a note
    expect(atolyeCss("tokens.css")).not.toContain("--color-signal-soft")
    for (const file of [
      "HomePage.tsx",
      "ProductPage.tsx",
      "order/OrderParts.tsx",
      "checkout/Consents.tsx",
    ]) {
      expect(atolyeCss(file), file).toContain("bg-highlight-soft")
    }
  })

  it("scales every section gap with the section spacing, the theme's own at normal (K-11)", () => {
    expect(entry.style(chosen({ section_spacing: "normal" }))).toBeNull()
    expect(entry.style(chosen({ section_spacing: "compact" }))).toBe(":root{--section-scale:0.55}")
    expect(entry.style(chosen({ section_spacing: "roomy" }))).toBe(":root{--section-scale:1.2}")
    for (const token of ["--section-gap-s", "--section-gap", "--section-gap-l"]) {
      expect(declared(tokens, token)).toMatch(/^calc\(\d+px \* var\(--section-scale, 1\)\)$/)
    }
    // A wide screen's gap at compact: 66 px, a dense catalog's rhythm
    const wide = /^calc\((\d+)px/.exec(declared(tokens, "--section-gap"))
    expect(Number(wide?.[1]) * 0.55).toBe(66)
    expect(themeSettings({ section_spacing: "dense" }, null).section_spacing).toBe("normal")
    expect(themeSettings({ section_spacing: "compact" }, null).section_spacing).toBe("compact")
  })

  it("keeps a sale apart from a red main colour: a graphite badge, an ink price (K-05)", () => {
    const deal = ["--color-deal:var(--color-text)", "--color-deal-ink:var(--color-paper)"]
    // Tezgâh's red, and reds around it
    for (const primary of ["#b3261e", "#be2323", "#d32f2f", "#a4161a"]) {
      expect(atolyeDeclarations(colours({ primary })), primary).toEqual(deal)
    }
    // Orange, wine, navy, the theme's own ink and a brown keep the theme's sale red
    for (const primary of ["#c2410c", "#7a1a48", "#2f6690", null, "#6b4a3a"]) {
      expect(atolyeDeclarations(colours({ primary })), String(primary)).toEqual([])
    }
  })

  it("leaves a malformed accent or an unknown tone out of CSS", () => {
    expect(
      entry.style(themeSettings({ colors: { accent: "#fff}", background: "pink" } }, null))
    ).toBeNull()
  })

  it("keeps the header where it is and the cards' rating out of CSS: neither is a variable", () => {
    expect(
      entry.style(
        chosen({
          header: { layout: "centered", sticky: false },
          product_card: { ...DEFAULT_THEME.product_card, show_rating: true, show_brand: false },
        })
      )
    ).toBeNull()
  })
})
