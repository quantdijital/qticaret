import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { CardVariant } from "@qticaret/types"
import { SEARCH_LIMIT, allHits, searchTheme } from "../settings-search"
import { THEME_FIELDS, THEME_IDS } from "./theme-registry"

const t = (key: string) => i18next.t(key)
const standard: ReadonlySet<CardVariant> = new Set(["standard"])
const keys = (query: string, variants = standard, theme = GRAFIT_THEME) =>
  searchTheme(query, theme, variants, t).map((hit) => hit.field.key)

/** Every field path the theme's choices hold: what the registry is built from. */
const leaves = (value: object, prefix = ""): string[] =>
  Object.entries(value).flatMap(([key, inner]) =>
    inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? leaves(inner as object, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )

/** adr/0049 Ek 2026-11-15: the theme's settings in the settings search. */
describe("the theme panel's register", () => {
  it("names every field of the theme's choices but the header bar's two", () => {
    expect(THEME_FIELDS.map((field) => field.key).sort()).toEqual(
      leaves(GRAFIT_THEME)
        .filter((key) => !key.startsWith("header."))
        .sort()
    )
  })

  it("gives each a translated name, its own element and translated choices", () => {
    const ids = new Set(Object.values(THEME_IDS))
    expect(ids.size).toBe(THEME_FIELDS.length)
    for (const field of THEME_FIELDS) {
      for (const key of [field.label, field.term, ...field.options]) {
        if (key) {
          expect(i18next.exists(key), key).toBe(true)
        }
      }
    }
  })
})

describe("the settings search over the theme", () => {
  it("finds the colours, faces, corners and section spacing by their names", () => {
    expect(keys("ana renk")).toEqual(["colors.primary"])
    expect(keys("sayfa zemini")).toEqual(["colors.background"])
    expect(keys("yazı tipleri font")).toEqual(["typography.heading", "typography.body"])
    expect(keys("köşeler")).toEqual(["radius"])
    expect(keys("bolum araligi")).toEqual(["section_spacing"])
    expect(keys("kutu stili")).toEqual(["surface_style"])
    // "Çizgili" is a box style and, since adr/0067 step 1, the menu's "Alt çizgili"
    expect(keys("cizgili")).toEqual(["surface_style", "menu_style"])
  })

  it("finds the menu style once the storefront draws it (adr/0067 S1)", () => {
    expect(keys("menü stili")).toEqual(["menu_style"])
    expect(keys("menu items")).toEqual(["menu_style"])
    const [plain] = searchTheme("sade", GRAFIT_THEME, standard, t)
    expect(plain).toMatchObject({ field: { key: "menu_style" } })
  })

  it("finds a field by its technical term and a choice by its name, naming it", () => {
    expect(keys("aspect-ratio")).toEqual(["product_card.ratio"])
    const [pill] = searchTheme("hap", GRAFIT_THEME, standard, t)
    expect(pill).toMatchObject({
      theme: true,
      field: { key: "buttons", target: "theme-buttons" },
      option: "storefront.editor.theme.buttonShapes.pill",
    })
  })

  it("narrows with the panel's or the group's name", () => {
    expect(keys("tema ana renk")).toEqual(["colors.primary"])
    expect(keys("ürün kartı biçimi")).toEqual(["product_card.variant"])
  })

  it("finds the card's pills, rows and button (Ek 2026-11-15), hiding what means nothing now", () => {
    const card = GRAFIT_THEME.product_card
    const framedRail: ReadonlySet<CardVariant> = new Set(["standard", "framed"])
    expect(keys("badge")).toEqual([
      "product_card.sale_badge",
      "product_card.low_stock_badge",
      "product_card.sold_out_badge",
    ])
    // Only compact cards: they draw no "Az kaldı"; a rail drawing standard brings it back
    expect(keys("badge", new Set(["compact"]))).not.toContain("product_card.low_stock_badge")
    expect(keys("badge", new Set(["compact", "standard"]))).toContain(
      "product_card.low_stock_badge"
    )
    expect(keys("gelince haber ver")).toEqual(["product_card.sold_out_row"])
    // The stars' place without reviews, only while the stars are shown
    expect(keys("ilk yorumu")).toEqual([])
    const stars = { ...GRAFIT_THEME, product_card: { ...card, show_rating: true } }
    expect(keys("ilk yorumu", standard, stars)).toEqual(["product_card.no_reviews"])
    // The foot button's look, only while there is one
    // ("stili" also names the box style, Z-04: the button's is the one at stake)
    expect(keys("düğme stili", framedRail)).toContain("product_card.button_style")
    const round = { ...GRAFIT_THEME, product_card: { ...card, full_button: false } }
    expect(keys("düğme stili", framedRail, round)).not.toContain("product_card.button_style")
    // The quick view: its switch always, its look and contents only while it is on
    expect(keys("quick view")).toEqual(["product_card.quick_view"])
    expect(keys("hızlı bakış")).toEqual(["product_card.quick_view"])
    const quick = { ...GRAFIT_THEME, product_card: { ...card, quick_view: true } }
    expect(keys("quick view", standard, quick)).toEqual([
      "product_card.quick_view",
      "product_card.quick_view_rating",
      "product_card.quick_view_summary",
      "product_card.quick_view_quantity",
    ])
    expect(keys("her zaman simge", standard, quick)).toEqual(["product_card.quick_view_trigger"])
    expect(keys("her zaman simge")).toEqual([])
  })

  it("puts the page's parts first and caps the whole list", () => {
    const theme = searchTheme("a", GRAFIT_THEME, standard, t)
    expect(allHits([], theme).length).toBeLessThanOrEqual(SEARCH_LIMIT)
    expect(searchTheme("  ", GRAFIT_THEME, standard, t)).toEqual([])
  })
})
