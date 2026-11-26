import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  GRAFIT_THEME,
  HEADING_FONTS,
  BODY_FONTS,
  NO_LIRA_FONTS,
  SINGLE_WEIGHT_FONTS,
} from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { GRAFIT_VALUES, isGrafit, themeValuesOf } from "./theme-settings"

const SAVED: ThemeSettings = {
  settings_version: 2,
  theme: "atolye",
  colors: { primary: null, accent: "#C2410C", background: "warm" },
  typography: { heading: "fraunces", body: "inter" },
  radius: "soft",
  product_card: {
    ratio: "4:5",
    show_brand: true,
    show_rating: false,
    variant: "standard",
    hover_image: true,
    hover_cycle: false,
    density: "regular",
    delivery_note: true,
    full_button: true,
    sale_badge: true,
    low_stock_badge: true,
    sold_out_badge: true,
    sold_out_row: "price",
    no_reviews: "hide",
    button_style: "outline",
    quick_view: false,
    quick_view_trigger: "hover",
    quick_view_rating: true,
    quick_view_summary: true,
    quick_view_quantity: true,
    text_position: "below",
    rating_badge: false,
    arrow: false,
    duration_row: false,
    per_person: false,
  },
  header: { layout: "centered", sticky: true },
  buttons: "pill",
  section_spacing: "normal",
  surface_style: "filled",
  listing_text: { size: "md", align: "start", width: "narrow", collapse: true },
  listing_page: {
    default_view: "list",
    view_switch: "show",
    breadcrumb_current: "hide",
    count_word: null,
  },
  search_form: {
    attribute_key: "bolge",
    show_category: true,
    show_dates: false,
    show_people: true,
    flexible_month: true,
    date_words: false,
    boxed_fields: false,
    category_style: "tabs",
    tabs: [],
    tab_all: true,
    placeholder: null,
  },
  menu_style: "filled",
  shadow: "float",
  chip_style: "filled",
  media_ground: "well",
  density: "airy",
  motion: "calm",
  page_width: "standard",
  accent_ink: "auto",
}

describe("the theme settings as the form holds them (adr/0053 §B)", () => {
  it("shows no colour of the shop's own as an empty field, the rest as the draft holds it", () => {
    expect(themeValuesOf(SAVED)).toEqual({
      colors: { primary: "", accent: "#C2410C", background: "warm" },
      typography: { heading: "fraunces", body: "inter" },
      radius: "soft",
      product_card: { ...SAVED.product_card },
      header: { layout: "centered", sticky: true },
      buttons: "pill",
      section_spacing: "normal",
      surface_style: "filled",
      listing_text: { size: "md", align: "start", width: "narrow", collapse: true },
      listing_page: {
        default_view: "list",
        view_switch: "show",
        breadcrumb_current: "hide",
        count_word: null,
      },
      search_form: { ...SAVED.search_form },
      menu_style: "filled",
      shadow: "float",
      chip_style: "filled",
      media_ground: "well",
      density: "airy",
      motion: "calm",
      page_width: "standard",
      accent_ink: "auto",
    })
  })
})

describe("Grafit, the theme's defaults (adr/0062 §2)", () => {
  it("is today's look: the backend's defaults and the storefront's, in the panel's one copy", () => {
    expect(GRAFIT_THEME).toEqual({
      colors: { primary: null, accent: null, background: "steel" },
      typography: { heading: "manrope", body: "manrope" },
      radius: "soft",
      product_card: {
        ratio: "1:1",
        show_brand: true,
        show_rating: false,
        variant: "standard",
        hover_image: true,
        hover_cycle: false,
        density: "regular",
        delivery_note: true,
        full_button: true,
        sale_badge: true,
        low_stock_badge: true,
        sold_out_badge: true,
        sold_out_row: "price",
        no_reviews: "hide",
        button_style: "outline",
        quick_view: false,
        quick_view_trigger: "hover",
        quick_view_rating: true,
        quick_view_summary: true,
        quick_view_quantity: true,
        text_position: "below",
        rating_badge: false,
        arrow: false,
        duration_row: false,
        per_person: false,
      },
      header: { layout: "left", sticky: true },
      buttons: "pill",
      section_spacing: "normal",
      surface_style: "filled",
      listing_text: { size: "md", align: "start", width: "narrow", collapse: true },
      listing_page: {
        default_view: "grid",
        view_switch: "hide",
        breadcrumb_current: "show",
        count_word: null,
      },
      search_form: {
        attribute_key: null,
        show_category: true,
        show_dates: true,
        show_people: true,
        flexible_month: true,
        date_words: false,
        boxed_fields: false,
        category_style: "select",
        tabs: [],
        tab_all: true,
        placeholder: null,
      },
      menu_style: "filled",
      shadow: "float",
      chip_style: "filled",
      media_ground: "well",
      density: "airy",
      motion: "calm",
      page_width: "standard",
      accent_ink: "auto",
    })
    // As the form holds it
    expect(GRAFIT_VALUES.colors).toEqual({ primary: "", accent: "", background: "steel" })
  })

  it("knows a form that holds Grafit from one a single choice away", () => {
    expect(isGrafit(GRAFIT_VALUES)).toBe(true)
    expect(isGrafit(themeValuesOf({ ...SAVED, ...GRAFIT_THEME }))).toBe(true)
    const g = GRAFIT_VALUES
    const away: (typeof GRAFIT_VALUES)[] = [
      { ...g, colors: { ...g.colors, primary: "#0b5c99" } },
      { ...g, colors: { ...g.colors, accent: "#c2410c" } },
      { ...g, colors: { ...g.colors, background: "warm" } },
      { ...g, typography: { ...g.typography, heading: "fraunces" } },
      { ...g, typography: { ...g.typography, body: "inter" } },
      { ...g, radius: "sharp" },
      { ...g, buttons: "square" },
      { ...g, section_spacing: "compact" },
      { ...g, surface_style: "lined" },
      // The style kit (adr/0067): a field the panel hides yet still counts
      { ...g, menu_style: "plain" },
      { ...g, shadow: "none" },
      { ...g, chip_style: "lined" },
      { ...g, media_ground: "page" },
      { ...g, density: "balanced" },
      { ...g, motion: "lively" },
      { ...g, radius: "gentle" },
      { ...g, section_spacing: "tight" },
      // The listing pages' text (adr/0075 §6)
      { ...g, listing_text: { ...g.listing_text, size: "lg" } },
      { ...g, listing_text: { ...g.listing_text, collapse: false } },
      { ...g, product_card: { ...g.product_card, ratio: "4:5" } },
      { ...g, product_card: { ...g.product_card, show_brand: false } },
      { ...g, product_card: { ...g.product_card, show_rating: true } },
      { ...g, product_card: { ...g.product_card, variant: "framed" } },
      { ...g, product_card: { ...g.product_card, hover_image: false } },
      { ...g, product_card: { ...g.product_card, sale_badge: false } },
      { ...g, product_card: { ...g.product_card, sold_out_row: "notify" } },
      { ...g, product_card: { ...g.product_card, no_reviews: "empty_stars" } },
      { ...g, product_card: { ...g.product_card, button_style: "solid" } },
      { ...g, header: { ...g.header, layout: "centered" } },
      { ...g, header: { ...g.header, sticky: false } },
    ]
    expect(away.map(isGrafit)).toEqual(away.map(() => false))
  })

  it("leaves the search box's fields out: they are what the box asks, not the look (adr/0077 §1)", () => {
    const g = GRAFIT_VALUES
    expect(isGrafit({ ...g, search_form: { ...SAVED.search_form } })).toBe(true)
  })

  it("reads a draft from before the search box at the box's defaults", () => {
    const old: Partial<ThemeSettings> = { ...SAVED }
    delete old.search_form
    expect(themeValuesOf(old as ThemeSettings).search_form).toEqual(GRAFIT_THEME.search_form)
  })
})

describe("what the form says about a heading face (adr/0062 §7)", () => {
  // Tests run from the package; the faces' files are the storefront's
  const css = readFileSync(
    join(process.cwd(), "..", "storefront", "src", "app", "fonts.css"),
    "utf8"
  )
  /** The `@font-face` blocks the storefront declares for a face. */
  const blocks = (font: string) =>
    css.split("@font-face").filter((block) => block.includes(`font-family: "qt-${font}";`))

  it("warns of no ₺ for exactly the faces whose files carry none", () => {
    const without = [...new Set([...HEADING_FONTS, ...BODY_FONTS])].filter(
      (font) => !blocks(font).some((block) => /unicode-range:[^;]*U\+20BA/i.test(block))
    )
    expect(without.sort()).toEqual([...NO_LIRA_FONTS].sort())
    // Prices are drawn in the body face: every body face must carry the sign
    expect(BODY_FONTS.filter((font) => (NO_LIRA_FONTS as ReadonlySet<string>).has(font))).toEqual(
      []
    )
  })

  it("warns of one weight for exactly the faces declared with a single weight", () => {
    const single = HEADING_FONTS.filter((font) => {
      const weights = blocks(font).map((block) => /font-weight:\s*([^;]+);/.exec(block)?.[1])
      expect(weights.length, font).toBeGreaterThan(0)
      // A variable face declares a range ("200 800"), a static one a single number
      return weights.every((weight) => /^\d+$/.test(weight?.trim() ?? ""))
    })
    expect([...single].sort()).toEqual([...SINGLE_WEIGHT_FONTS].sort())
  })
})
