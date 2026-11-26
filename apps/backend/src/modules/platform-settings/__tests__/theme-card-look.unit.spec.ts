import path from "node:path"
import { parseStored } from "../sections/stored"
import { CARD_META_PLACES, CARD_STYLES, themeSection, withCardDefaults } from "../sections/theme"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/storefront.ts"
)

const { full, defaults } = themeSection

/** sahip 2026-11-26: the card's details on the photo and its frosted panel, today's card by default. */
describe("theme section: the product card's details place and frame", () => {
  const issue = (product_card: Record<string, unknown>) =>
    full.safeParse({ ...defaults, product_card: { ...defaults.product_card, ...product_card } })
      .error?.issues[0]

  it("holds the contract's lists and draws today's card by default", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(CARD_META_PLACES).toEqual(contract["CARD_META_PLACES"])
    expect(CARD_STYLES).toEqual(contract["CARD_STYLES"])
    expect(defaults.product_card).toMatchObject({ meta_place: "below", style: "plain" })
  })

  it("takes each choice and refuses one off the list", () => {
    for (const meta_place of CARD_META_PLACES) {
      for (const style of CARD_STYLES) {
        expect(issue({ meta_place, style })).toBeUndefined()
      }
    }
    expect(issue({ meta_place: "side" })).toMatchObject({
      message: "platform_settings.invalid",
      path: ["product_card", "meta_place"],
    })
    expect(issue({ style: "neon" })).toMatchObject({
      message: "platform_settings.invalid",
      path: ["product_card", "style"],
    })
  })

  it("reads a row or preset saved before them as today's card", () => {
    const card = Object.fromEntries(
      Object.entries(defaults.product_card).filter(
        ([key]) => key !== "meta_place" && key !== "style"
      )
    )
    expect(parseStored("theme", { ...defaults, product_card: card })).toEqual(defaults)
    expect(withCardDefaults({ ...defaults, product_card: card })).toEqual(defaults)
  })
})
