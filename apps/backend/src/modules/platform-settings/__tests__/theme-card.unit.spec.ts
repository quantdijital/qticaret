import path from "node:path"
import { mergePatch } from "../sections/define"
import { parseStored } from "../sections/stored"
import {
  CARD_BUTTON_STYLES,
  CARD_NO_REVIEWS,
  CARD_SOLD_OUT_ROWS,
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
    const old = (empty_stars: boolean) => {
      const card: Record<string, unknown> = { ...defaults.product_card, empty_stars }
      delete card["no_reviews"]
      return { ...defaults, product_card: card }
    }
    const read = parseStored("theme", old(true))
    expect(read["product_card"]).toMatchObject({ no_reviews: "empty_stars" })
    expect(parseStored("theme", old(false))).toEqual(defaults)
    // A design's theme and a preset (`withCardDefaults`) read the same
    expect(withCardDefaults(old(true))).toEqual({
      ...defaults,
      product_card: { ...defaults.product_card, no_reviews: "empty_stars" },
    })
    expect(full.safeParse(withCardDefaults(old(false))).success).toBe(true)
    // A card holding both keeps its choice; anything not a card stays as it is
    expect(upgradeCard({ empty_stars: true, no_reviews: "write_first" })).toEqual({
      no_reviews: "write_first",
    })
    expect(upgradeCard(null)).toBeNull()
  })
})
