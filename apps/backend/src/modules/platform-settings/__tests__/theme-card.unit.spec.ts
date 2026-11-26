import path from "node:path"
import { mergePatch } from "../sections/define"
import { parseStored } from "../sections/stored"
import {
  CARD_BUTTON_STYLES,
  CARD_DENSITIES,
  CARD_NO_REVIEWS,
  CARD_QUICK_VIEW_TRIGGERS,
  CARD_RATIOS,
  CARD_SOLD_OUT_ROWS,
  CARD_TEXT_POSITIONS,
  themeSection,
  upgradeCard,
  withCardDefaults,
} from "../sections/theme"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/storefront.ts"
)

const { full, patch, defaults } = themeSection

/** adr/0049 Ek 2026-11-15: the owner's four card decisions, each a theme setting. */
describe("theme section: the product card's badges, sold-out row, no-reviews row and button", () => {
  it("holds the contract's lists, today's card first in none but its default", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(CARD_SOLD_OUT_ROWS).toEqual(contract["CARD_SOLD_OUT_ROWS"])
    expect(CARD_NO_REVIEWS).toEqual(contract["CARD_NO_REVIEWS"])
    expect(CARD_BUTTON_STYLES).toEqual(contract["CARD_BUTTON_STYLES"])
    expect(defaults.product_card).toMatchObject({
      sale_badge: true,
      low_stock_badge: true,
      sold_out_badge: true,
      sold_out_row: "price",
      no_reviews: "hide",
      button_style: "outline",
    })
  })

  it("takes each choice on its list, and refuses one off it with the error key", () => {
    const issue = (product_card: Record<string, unknown>) =>
      full.safeParse({ ...defaults, product_card: { ...defaults.product_card, ...product_card } })
        .error?.issues[0]
    for (const sold_out_row of CARD_SOLD_OUT_ROWS) {
      expect(issue({ sold_out_row })).toBeUndefined()
    }
    for (const no_reviews of CARD_NO_REVIEWS) {
      expect(issue({ no_reviews })).toBeUndefined()
    }
    for (const button_style of CARD_BUTTON_STYLES) {
      expect(issue({ button_style })).toBeUndefined()
    }
    expect(issue({ sold_out_row: "hidden" })).toMatchObject({
      message: "platform_settings.invalid",
      path: ["product_card", "sold_out_row"],
    })
    expect(issue({ button_style: "ghost" })?.message).toBe("platform_settings.invalid")
    expect(issue({ no_reviews: null })?.message).toBe("platform_settings.invalid")
    expect(issue({ sale_badge: "yes" })).toBeDefined()
  })

  it("keeps the stored choices on a patch that leaves them out (no default in the patch)", () => {
    const stored = full.parse({
      ...defaults,
      product_card: {
        ...defaults.product_card,
        sold_out_row: "notify",
        no_reviews: "write_first",
        button_style: "solid",
        sale_badge: false,
      },
    })
    const patched = patch.parse({ product_card: { ratio: "4:5" } })
    expect(patched).toEqual({ product_card: { ratio: "4:5" } })
    expect(full.parse(mergePatch(stored, patched)).product_card).toEqual({
      ...stored.product_card,
      ratio: "4:5",
    })
  })

  it("reads a row saved before them as today's card", () => {
    const left = ["sale_badge", "sold_out_row", "no_reviews", "button_style"]
    const card = Object.fromEntries(
      Object.entries(defaults.product_card).filter(([key]) => !left.includes(key))
    )
    expect(parseStored("theme", { ...defaults, product_card: card })).toEqual(defaults)
    expect(withCardDefaults({ ...defaults, product_card: card })).toEqual(defaults)
  })

  it("reads the framed card's old empty stars switch as the no-reviews choice", () => {
    const old = (empty_stars: boolean, variant = "framed") => {
      const card: Record<string, unknown> = { ...defaults.product_card, variant, empty_stars }
      delete card["no_reviews"]
      return { ...defaults, product_card: card }
    }
    const read = parseStored("theme", old(true))
    expect(read["product_card"]).toMatchObject({ variant: "framed", no_reviews: "empty_stars" })
    expect(parseStored("theme", old(false))["product_card"]).toMatchObject({
      variant: "framed",
      no_reviews: "hide",
    })
    // The switch drew only on the framed card: on another variant, on reads as hide
    for (const variant of ["standard", "compact"]) {
      expect(parseStored("theme", old(true, variant))["product_card"]).toMatchObject({
        variant,
        no_reviews: "hide",
      })
    }
    // A design's theme and a preset (`withCardDefaults`) read the same
    expect(withCardDefaults(old(true))).toEqual({
      ...defaults,
      product_card: { ...defaults.product_card, variant: "framed", no_reviews: "empty_stars" },
    })
    expect(withCardDefaults(old(true, "standard"))).toEqual({
      ...defaults,
      product_card: { ...defaults.product_card, variant: "standard", no_reviews: "hide" },
    })
    expect(full.safeParse(withCardDefaults(old(false))).success).toBe(true)
    // A chosen no_reviews holds on every card
    expect(
      upgradeCard({ variant: "standard", empty_stars: true, no_reviews: "empty_stars" })
    ).toEqual({
      variant: "standard",
      no_reviews: "empty_stars",
    })
    // A card holding both keeps its choice; anything not a card stays as it is
    expect(upgradeCard({ empty_stars: true, no_reviews: "write_first" })).toEqual({
      no_reviews: "write_first",
    })
    expect(upgradeCard(null)).toBeNull()
  })
})

/** adr/0049 Ek 2026-11-15: the quick view, off until the shop turns it on. */
describe("theme section: the product card's quick view", () => {
  const QUICK_VIEW_KEYS = [
    "quick_view",
    "quick_view_trigger",
    "quick_view_rating",
    "quick_view_summary",
    "quick_view_quantity",
  ]

  it("holds the contract's trigger list and draws no quick view by default", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(CARD_QUICK_VIEW_TRIGGERS).toEqual(contract["CARD_QUICK_VIEW_TRIGGERS"])
    expect(defaults.product_card).toMatchObject({
      quick_view: false,
      quick_view_trigger: "hover",
      quick_view_rating: true,
      quick_view_summary: true,
      quick_view_quantity: true,
    })
  })

  it("takes each trigger on its list and refuses one off it with the error key", () => {
    const issue = (product_card: Record<string, unknown>) =>
      full.safeParse({ ...defaults, product_card: { ...defaults.product_card, ...product_card } })
        .error?.issues[0]
    for (const quick_view_trigger of CARD_QUICK_VIEW_TRIGGERS) {
      expect(issue({ quick_view: true, quick_view_trigger })).toBeUndefined()
    }
    expect(issue({ quick_view_trigger: "always" })).toMatchObject({
      message: "platform_settings.invalid",
      path: ["product_card", "quick_view_trigger"],
    })
    expect(issue({ quick_view_trigger: null })?.message).toBe("platform_settings.invalid")
    expect(issue({ quick_view: "on" })).toBeDefined()
    expect(issue({ quick_view_quantity: 1 })).toBeDefined()
  })

  it("keeps the stored quick view on a patch that leaves it out", () => {
    const stored = full.parse({
      ...defaults,
      product_card: {
        ...defaults.product_card,
        quick_view: true,
        quick_view_trigger: "icon",
        quick_view_rating: false,
        quick_view_summary: false,
        quick_view_quantity: false,
      },
    })
    const patched = patch.parse({ product_card: { quick_view_summary: true } })
    expect(patched).toEqual({ product_card: { quick_view_summary: true } })
    expect(full.parse(mergePatch(stored, patched)).product_card).toEqual({
      ...stored.product_card,
      quick_view_summary: true,
    })
  })

  it("reads a row saved before it as today's card: no quick view", () => {
    const card = Object.fromEntries(
      Object.entries(defaults.product_card).filter(([key]) => !QUICK_VIEW_KEYS.includes(key))
    )
    expect(parseStored("theme", { ...defaults, product_card: card })).toEqual(defaults)
    expect(withCardDefaults({ ...defaults, product_card: card })).toEqual(defaults)
  })
})

/** adr/0077 Ek "tur kartı": the tour sites' card look, today's card until the shop asks. */
describe("theme section: the product card's tour look", () => {
  const TOUR_KEYS = ["text_position", "rating_badge", "arrow", "duration_row", "per_person"]
  const issue = (product_card: Record<string, unknown>) =>
    full.safeParse({ ...defaults, product_card: { ...defaults.product_card, ...product_card } })
      .error?.issues[0]

  it("holds the contract's list and draws today's card by default", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(CARD_TEXT_POSITIONS).toEqual(contract["CARD_TEXT_POSITIONS"])
    expect(defaults.product_card).toMatchObject({
      text_position: "below",
      rating_badge: false,
      arrow: false,
      duration_row: false,
      per_person: false,
    })
  })

  it("takes each choice and switch, and refuses a place off the list with the error key", () => {
    for (const text_position of CARD_TEXT_POSITIONS) {
      expect(issue({ text_position })).toBeUndefined()
    }
    expect(
      issue({ rating_badge: true, arrow: true, duration_row: true, per_person: true })
    ).toBeUndefined()
    expect(issue({ text_position: "beside" })).toMatchObject({
      message: "platform_settings.invalid",
      path: ["product_card", "text_position"],
    })
    expect(issue({ per_person: "yes" })).toBeDefined()
    expect(issue({ badge_text: "Yeni" })).toBeDefined()
  })

  it("keeps the stored look on a patch that leaves it out", () => {
    const stored = full.parse({
      ...defaults,
      product_card: { ...defaults.product_card, text_position: "over", per_person: true },
    })
    const patched = patch.parse({ product_card: { arrow: true } })
    expect(full.parse(mergePatch(stored, patched)).product_card).toEqual({
      ...stored.product_card,
      arrow: true,
    })
  })

  it("reads a row or preset saved before it as today's card", () => {
    const card = Object.fromEntries(
      Object.entries(defaults.product_card).filter(([key]) => !TOUR_KEYS.includes(key))
    )
    expect(parseStored("theme", { ...defaults, product_card: card })).toEqual(defaults)
    expect(withCardDefaults({ ...defaults, product_card: card })).toEqual(defaults)
  })
})

/** sahip 2026-11-26: the compact tour card, its short photo and every photo on hover. */
describe("theme section: the product card's density, short photo and photo cycle", () => {
  const issue = (product_card: Record<string, unknown>) =>
    full.safeParse({ ...defaults, product_card: { ...defaults.product_card, ...product_card } })
      .error?.issues[0]

  it("holds the contract's lists and draws today's card by default", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(CARD_RATIOS).toEqual(contract["CARD_RATIOS"])
    expect(CARD_DENSITIES).toEqual(contract["CARD_DENSITIES"])
    expect(defaults.product_card).toMatchObject({ hover_cycle: false, density: "regular" })
  })

  it("takes each choice and refuses one off the list", () => {
    for (const density of CARD_DENSITIES) {
      expect(issue({ density })).toBeUndefined()
    }
    expect(issue({ ratio: "4:3", hover_cycle: true })).toBeUndefined()
    expect(issue({ density: "airy" })).toMatchObject({
      message: "platform_settings.invalid",
      path: ["product_card", "density"],
    })
    expect(issue({ ratio: "16:9" })).toBeDefined()
    expect(issue({ hover_cycle: "yes" })).toBeDefined()
  })

  it("reads a row or preset saved before them as today's card", () => {
    const card = Object.fromEntries(
      Object.entries(defaults.product_card).filter(
        ([key]) => key !== "hover_cycle" && key !== "density"
      )
    )
    expect(parseStored("theme", { ...defaults, product_card: card })).toEqual(defaults)
    expect(withCardDefaults({ ...defaults, product_card: card })).toEqual(defaults)
  })
})
