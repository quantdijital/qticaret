import path from "node:path"
import { mergePatch } from "../sections/define"
import { parseStored } from "../sections/stored"
import {
  SECTION_SPACINGS,
  SURFACE_STYLES,
  THEME_BACKGROUNDS,
  THEME_WELLS,
  primaryReadable,
  primaryReadableInWell,
  themeSaveIssue,
  themeSection,
  upgradeStoredTheme,
  withCardDefaults,
} from "../sections/theme"
import type { ThemeSettings } from "../sections/theme"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/storefront.ts"
)

const { full, patch, defaults } = themeSection

const saved = (body: Record<string, unknown>) => full.safeParse(mergePatch(defaults, body))
const issueOf = (body: Record<string, unknown>) => saved(body).error?.issues[0]

describe("theme section", () => {
  it("starts as today's Grafit look, and its defaults pass its own checks (adr/0062 §2)", () => {
    expect(defaults).toEqual({
      settings_version: 2,
      theme: "atolye",
      colors: { primary: null, accent: null, background: "steel" },
      typography: { heading: "manrope", body: "manrope" },
      radius: "soft",
      product_card: {
        ratio: "1:1",
        show_brand: true,
        show_rating: false,
        // adr/0049 Ek 2026-11-14 §3.3: today's card; the framed card's switches for when it is chosen
        variant: "standard",
        hover_image: true,
        delivery_note: true,
        full_button: true,
        // adr/0049 Ek 2026-11-15: every pill, the price on a sold-out card, no stars without reviews
        sale_badge: true,
        low_stock_badge: true,
        sold_out_badge: true,
        sold_out_row: "price",
        no_reviews: "hide",
        button_style: "outline",
        // adr/0049 Ek 2026-11-15: no quick view until the shop turns it on
        quick_view: false,
        quick_view_trigger: "hover",
        quick_view_rating: true,
        quick_view_summary: true,
        quick_view_quantity: true,
      },
      header: { layout: "left", sticky: true },
      buttons: "pill",
      section_spacing: "normal",
      surface_style: "filled",
    })
    expect(full.safeParse(defaults).success).toBe(true)
    expect(parseStored("theme", undefined)).toEqual(defaults)
  })

  it("offers Grafit's steel counter beside the three earlier page colours (adr/0062 §3)", () => {
    // `steel` is Atölye's `--color-paper`, oklch(98.4% 0.003 250), in sRGB: the
    // storefront's theme spec derives it from the token. The storefront and
    // the panel hold the same four values
    expect(THEME_BACKGROUNDS).toEqual({
      steel: "#f8fafc",
      warm: "#f6f4ef",
      neutral: "#f5f5f5",
      cool: "#f3f5f8",
    })
    for (const background of Object.keys(THEME_BACKGROUNDS)) {
      expect(saved({ colors: { primary: null, accent: null, background } }).success).toBe(true)
    }
  })

  it("reads a section stored with the removed first theme as Atölye (adr/0057 Ek 2026-11-09)", () => {
    expect(full.parse(mergePatch(defaults, { theme: "base" })).theme).toBe("atolye")
    expect(patch.parse({ theme: "base" })).toEqual({ theme: "atolye" })
  })

  it("takes the shop's choices, a colour in lower case", () => {
    const parsed = full.parse(
      mergePatch(defaults, {
        colors: { primary: " #0B5C99 ", accent: "#B42318", background: "cool" },
        typography: { heading: "playfair", body: "nunito" },
        radius: "round",
        product_card: { ratio: "1:1", show_brand: false, show_rating: true },
        header: { layout: "left", sticky: false },
        buttons: "square",
      })
    )

    expect(parsed.colors).toEqual({ primary: "#0b5c99", accent: "#b42318", background: "cool" })
    expect(parsed.typography).toEqual({ heading: "playfair", body: "nunito" })
  })

  it("keeps a nested group's other fields when the panel sends one", () => {
    const body = patch.parse({ colors: { primary: "#1a1814" } })
    const merged = full.parse(mergePatch(defaults, body))
    expect(merged.colors).toEqual({ primary: "#1a1814", accent: null, background: "steel" })
  })

  it.each([
    ["an unknown theme", { theme: "dawn" }],
    ["a font that is not ours", { typography: { heading: "comic-sans", body: "inter" } }],
    ["a font address", { typography: { heading: "https://fonts.example/x.woff2", body: "inter" } }],
    ["a colour name", { colors: { primary: "red", accent: null, background: "warm" } }],
    ["a short colour", { colors: { primary: "#fff", accent: null, background: "warm" } }],
    ["an unknown page colour", { colors: { primary: null, accent: null, background: "pink" } }],
    ["a card shape", { product_card: { ratio: "16:9", show_brand: true, show_rating: false } }],
    ["a button shape", { buttons: "blob" }],
    ["a section spacing off the list", { section_spacing: "dense" }],
    ["a section spacing in pixels", { section_spacing: 64 }],
    ["a surface style off the list", { surface_style: "glass" }],
    ["CSS of its own", { css: "body{display:none}" }],
    ["a version it does not write", { settings_version: 1 }],
  ])("refuses %s", (_, body) => {
    expect(saved(body).success).toBe(false)
  })

  it("refuses a main colour white text or the page cannot carry (WCAG AA large, 3:1)", () => {
    // Pale yellow: 1.1:1 on white
    const pale = issueOf({ colors: { primary: "#fde68a", accent: null, background: "warm" } })
    expect(pale?.message).toBe("platform_settings.color_contrast")
    expect(pale?.path).toEqual(["colors", "primary"])
    // #949494 reaches 3:1 on white, not on the warm page
    expect(primaryReadable("#949494", "warm")).toBe(false)
    expect(
      issueOf({ colors: { primary: "#949494", accent: null, background: "warm" } })?.message
    ).toBe("platform_settings.color_contrast")
    // Dark enough for both, on every page
    for (const background of ["steel", "warm", "neutral", "cool"] as const) {
      expect(saved({ colors: { primary: "#2f6feb", accent: null, background } }).success).toBe(true)
      expect(primaryReadable("#1a1814", background)).toBe(true)
    }
  })

  it("checks the colour against the page it is saved with, each as the storefront paints it", () => {
    const on = (primary: string, background: string) =>
      saved({ colors: { primary, accent: null, background } }).success
    // Every grey here reaches 3:1 on white; the pages are darker, each by its own measure.
    // #919191: 3.01:1 on steel (the lightest), 2.87 to 2.89 on the others
    expect(on("#919191", "steel")).toBe(true)
    expect(["warm", "neutral", "cool"].map((page) => on("#919191", page))).toEqual([
      false,
      false,
      false,
    ])
    // #929292: 2.97:1 on steel
    expect(on("#929292", "steel")).toBe(false)
    // #8e8e8e: 3.13:1 on steel, 3.005 on neutral, 2.9996 on cool, 2.98 on warm
    expect(on("#8e8e8e", "steel")).toBe(true)
    expect(on("#8e8e8e", "neutral")).toBe(true)
    expect(on("#8e8e8e", "cool")).toBe(false)
    expect(on("#8e8e8e", "warm")).toBe(false)
    // #8d8d8d: 3.02:1 on warm, the darkest page
    expect(on("#8d8d8d", "warm")).toBe(true)
    expect(on("#8d8d8d", "cool")).toBe(true)
  })
})

describe("a theme row stored before adr/0062 (no settings_version)", () => {
  // What `saveSection` wrote then: every field, the old defaults where untouched
  const oldDefaults = {
    theme: "atolye",
    colors: { primary: null, accent: null, background: "warm" },
    typography: { heading: "fraunces", body: "inter" },
    radius: "soft",
    product_card: { ratio: "4:5", show_brand: true, show_rating: false },
    header: { layout: "centered", sticky: true },
    buttons: "pill",
  }

  it("reads the old defaults as Grafit: the storefront drew nothing else", () => {
    expect(parseStored("theme", oldDefaults)).toEqual(defaults)
    // The first theme's name, from before adr/0057 Ek 2026-11-09
    expect(parseStored("theme", { ...oldDefaults, theme: "base" })).toEqual(defaults)
  })

  it("keeps what Atölye showed: the main colour, the cards' brand and shape, the sticky header", () => {
    const stored = {
      ...oldDefaults,
      colors: { primary: "#7a1a48", accent: null, background: "warm" },
      product_card: { ratio: "3:4", show_brand: false, show_rating: false },
      header: { layout: "centered", sticky: false },
    }
    expect(parseStored("theme", stored)).toEqual({
      ...defaults,
      colors: { ...defaults.colors, primary: "#7a1a48" },
      product_card: { ...defaults.product_card, ratio: "3:4", show_brand: false },
      header: { layout: "left", sticky: false },
    })
    const square = { ...stored, product_card: { ...stored.product_card, ratio: "1:1" } }
    expect(parseStored("theme", square)["product_card"]).toMatchObject({ ratio: "1:1" })
  })

  it("takes to Grafit every choice that never showed, and a 4:5 card that was drawn square", () => {
    const stored = {
      theme: "atolye",
      colors: { primary: "#0b5c99", accent: "#f5d90a", background: "cool" },
      typography: { heading: "playfair", body: "nunito" },
      radius: "round",
      product_card: { ratio: "4:5", show_brand: true, show_rating: true },
      header: { layout: "centered", sticky: true },
      buttons: "square",
    }
    expect(parseStored("theme", stored)).toEqual({
      ...defaults,
      colors: { primary: "#0b5c99", accent: null, background: "steel" },
    })
  })

  it("keeps a main colour that passed on its old page: steel is the lightest of the four", () => {
    // #8d8d8d: 3.02:1 on the warm page it was saved with, 3.17 on steel
    const stored = { ...oldDefaults, colors: { ...oldDefaults.colors, primary: "#8d8d8d" } }
    expect(parseStored("theme", stored)["colors"]).toEqual({
      primary: "#8d8d8d",
      accent: null,
      background: "steel",
    })
  })

  it("reads a partial or malformed row without failing", () => {
    expect(parseStored("theme", { colors: { primary: "#7a1a48" } })).toEqual({
      ...defaults,
      colors: { ...defaults.colors, primary: "#7a1a48" },
    })
    expect(parseStored("theme", { colors: "red", product_card: null, header: [] })).toEqual(
      defaults
    )
    expect(parseStored("theme", {})).toEqual(defaults)
  })

  it("is written with the version by its next save, and left alone from then on", () => {
    const before = parseStored("theme", { ...oldDefaults, radius: "round" })
    const after = full.parse(mergePatch(before, patch.parse({ radius: "round" })))
    expect(after).toEqual({ ...defaults, radius: "round" })
    expect(parseStored("theme", after)).toEqual(after)
  })
})

describe("a theme row stored since adr/0062 (settings_version 2)", () => {
  it("is the shop's choice in every field, the old defaults' values included", () => {
    const stored = {
      settings_version: 2,
      theme: "atolye",
      colors: { primary: "#0b5c99", accent: "#f5d90a", background: "warm" },
      typography: { heading: "fraunces", body: "inter" },
      radius: "round",
      product_card: { ratio: "4:5", show_brand: false, show_rating: true },
      header: { layout: "centered", sticky: false },
      buttons: "square",
    }
    expect(upgradeStoredTheme(stored)).toBe(stored)
    // Its card stored before the variant and E5 fields: read over the defaults, today's card
    expect(parseStored("theme", stored)).toEqual({
      ...stored,
      product_card: { ...defaults.product_card, ...stored.product_card },
      // Stored before the section spacing (K-11): the theme's own gaps
      section_spacing: "normal",
      // and before the surface style (Z-04): today's filled boxes
      surface_style: "filled",
    })
    const framed = {
      ...stored,
      section_spacing: "compact",
      surface_style: "lined",
      product_card: { ...defaults.product_card, variant: "framed" },
    }
    expect(parseStored("theme", framed)).toEqual(framed)
  })

  it("takes a card variant on its list only (adr/0049 Ek 2026-11-14 §3.3)", () => {
    const card = (product_card: Record<string, unknown>) =>
      full.safeParse({ ...defaults, product_card: { ...defaults.product_card, ...product_card } })
        .success
    expect(card({ variant: "framed", hover_image: false, no_reviews: "empty_stars" })).toBe(true)
    // `technical` comes with Faz 4's card facts, not yet
    expect(card({ variant: "technical" })).toBe(false)
    expect(card({ full_button: "yes" })).toBe(false)
    // A patch of one switch keeps the others
    const after = full.parse(
      mergePatch(defaults, patch.parse({ product_card: { full_button: false } }))
    )
    expect(after.product_card).toEqual({ ...defaults.product_card, full_button: false })
  })

  it("takes the section spacing from its list, the contract's (Tezgâh audit K-11)", () => {
    const contract = jest.requireActual<{ SECTION_SPACINGS: unknown }>(CONTRACT_FILE)
    expect(SECTION_SPACINGS).toEqual(contract.SECTION_SPACINGS)
    for (const section_spacing of SECTION_SPACINGS) {
      expect(saved({ section_spacing }).success).toBe(true)
    }
    expect(full.parse(mergePatch(defaults, patch.parse({ section_spacing: "compact" })))).toEqual({
      ...defaults,
      section_spacing: "compact",
    })
    // A design's theme or a preset written before it reads with the theme's own gaps
    const before: Record<string, unknown> = { ...defaults }
    delete before["section_spacing"]
    expect(withCardDefaults(before)).toEqual(defaults)
    expect(withCardDefaults({ ...defaults, section_spacing: "roomy" })).toMatchObject({
      section_spacing: "roomy",
    })
  })

  it("takes the surface style from its list, the contract's; one stored before it reads filled (Z-04)", () => {
    const contract = jest.requireActual<{ SURFACE_STYLES: unknown }>(CONTRACT_FILE)
    expect(SURFACE_STYLES).toEqual(contract.SURFACE_STYLES)
    for (const surface_style of SURFACE_STYLES) {
      expect(saved({ surface_style }).success).toBe(true)
    }
    expect(full.parse(mergePatch(defaults, patch.parse({ surface_style: "lined" })))).toEqual({
      ...defaults,
      surface_style: "lined",
    })
    const before: Record<string, unknown> = { ...defaults }
    delete before["surface_style"]
    expect(withCardDefaults(before)).toEqual(defaults)
    expect(parseStored("theme", before)).toEqual(defaults)
    expect(withCardDefaults({ ...defaults, surface_style: "lined" })).toMatchObject({
      surface_style: "lined",
    })
  })
})

describe("the main colour in the page's well (adr/0062 §6): a rule for saves, not for stored rows", () => {
  const withColors = (primary: string | null, background: ThemeSettings["colors"]["background"]) =>
    ({ ...defaults, colors: { primary, accent: null, background } }) satisfies ThemeSettings
  const refused = { message: "platform_settings.color_contrast", path: ["colors", "primary"] }

  it("holds each tone's well as the theme paints it (Atölye's paper-2)", () => {
    expect(THEME_WELLS).toEqual({
      steel: "#eef1f4",
      warm: "#eeebe2",
      neutral: "#ececec",
      cool: "#e9ecf1",
    })
    expect(Object.keys(THEME_WELLS)).toEqual(Object.keys(THEME_BACKGROUNDS))
  })

  it("refuses a newly chosen colour the well cannot carry, though the page can", () => {
    // #919191: 3.01:1 on steel's page, 2.78 in its well
    expect(primaryReadable("#919191", "steel")).toBe(true)
    expect(primaryReadableInWell("#919191", "steel")).toBe(false)
    expect(themeSaveIssue(withColors("#919191", "steel"), defaults)).toEqual(refused)
    // #8a8a8a: 3.05 in steel's well
    expect(themeSaveIssue(withColors("#8a8a8a", "steel"), defaults)).toBeNull()
    // Warm's well is darker: #8d8d8d reads on the page (3.02), not in the well (2.78); #878787 does (3.01)
    expect(primaryReadable("#8d8d8d", "warm")).toBe(true)
    expect(themeSaveIssue(withColors("#8d8d8d", "warm"), defaults)).toEqual(refused)
    expect(themeSaveIssue(withColors("#878787", "warm"), defaults)).toBeNull()
    for (const background of ["steel", "warm", "neutral", "cool"] as const) {
      expect(themeSaveIssue(withColors("#2f6feb", background), defaults)).toBeNull()
      expect(themeSaveIssue(withColors(null, background), defaults)).toBeNull()
    }
  })

  it("asks again when the page colour changes under a kept colour", () => {
    // #8a8a8a reads in steel's well (3.05), not in warm's (2.90)
    const before = withColors("#8a8a8a", "steel")
    expect(themeSaveIssue(withColors("#8a8a8a", "warm"), before)).toEqual(refused)
  })

  it("leaves a colour saved before the rule alone: it reads as stored and other fields still save", () => {
    const stored = { ...withColors("#919191", "steel") }
    // Read: the stored row passes as it is (a failed read would put the colour back to none)
    expect(parseStored("theme", stored)).toEqual(stored)
    expect(full.safeParse(stored).success).toBe(true)
    // A save that touches neither the colour nor the page colour goes through
    expect(themeSaveIssue({ ...stored, radius: "round", buttons: "square" }, stored)).toBeNull()
    expect(
      themeSaveIssue({ ...stored, colors: { ...stored.colors, accent: "#f5d90a" } }, stored)
    ).toBeNull()
    // Choosing another borderline colour is a new choice
    expect(themeSaveIssue(withColors("#909090", "steel"), stored)).toEqual(refused)
  })

  it("is the theme section's save check", () => {
    expect(themeSection.saveIssue).toBe(themeSaveIssue)
  })
})
