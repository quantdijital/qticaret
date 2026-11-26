import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { CARD_LOOK_DEFAULTS, cardLook, cardLookOf, durationWords } from "../card-look"
import { DEFAULT_THEME } from "../theme"
import { productCard } from "../product"
import type { StoreProduct } from "@qticaret/types"

/** adr/0077 Ek "tur kartı": the theme setting's look on the card's view. */
describe("cardLookOf", () => {
  const card = DEFAULT_THEME.product_card

  it("is today's card at the defaults, and leaves the view without a look", () => {
    expect(cardLookOf(card)).toEqual(CARD_LOOK_DEFAULTS)
    expect(cardLook(cardLookOf(card))).toBeUndefined()
    expect(cardLook(undefined)).toBeUndefined()
  })

  it("reads each setting, the stars' pill only while the stars are shown", () => {
    const all = {
      ...card,
      text_position: "over" as const,
      rating_badge: true,
      arrow: true,
      duration_row: true,
      per_person: true,
    }
    expect(cardLookOf({ ...all, show_rating: true })).toEqual({
      over: true,
      split: false,
      ratingBadge: true,
      arrow: true,
      duration: true,
      perPerson: true,
      compact: false,
    })
    expect(cardLookOf({ ...card, density: "compact" })).toEqual({
      ...CARD_LOOK_DEFAULTS,
      compact: true,
    })
    expect(cardLookOf({ ...all, show_rating: false }).ratingBadge).toBe(false)
    const split = cardLookOf({ ...all, text_position: "over_split", show_rating: true })
    expect(split.over && split.split).toBe(true)
    expect(cardLook(cardLookOf({ ...card, arrow: true }))).toEqual({
      ...CARD_LOOK_DEFAULTS,
      arrow: true,
    })
  })

  it("puts the look on a card only when the shop changed it", () => {
    const product = {
      id: "p",
      title: "Tur",
      handle: "tur",
      subtitle: null,
      description: null,
      thumbnail: null,
      variants: [],
    } as unknown as StoreProduct
    const options = { showBrand: true, showRating: false }
    expect(productCard(product, "/urun/tur", {}, options)).not.toHaveProperty("look")
    expect(
      productCard(product, "/urun/tur", {}, { ...options, look: CARD_LOOK_DEFAULTS })
    ).not.toHaveProperty("look")
    expect(
      productCard(
        product,
        "/urun/tur",
        {},
        {
          ...options,
          look: { ...CARD_LOOK_DEFAULTS, perPerson: true },
        }
      ).look
    ).toEqual({ ...CARD_LOOK_DEFAULTS, perPerson: true })
  })

  it("carries the subtitle on a split card only", () => {
    const product = {
      id: "p",
      title: "Tur",
      handle: "tur",
      subtitle: "Göller ve dağlar",
      description: null,
      thumbnail: null,
      variants: [],
    } as unknown as StoreProduct
    const options = { showBrand: true, showRating: false }
    const over = { ...CARD_LOOK_DEFAULTS, over: true }
    expect(productCard(product, "/urun/tur", {}, { ...options, look: over })).not.toHaveProperty(
      "subtitle"
    )
    expect(
      productCard(product, "/urun/tur", {}, { ...options, look: { ...over, split: true } }).subtitle
    ).toBe("Göller ve dağlar")
  })
})

describe("durationWords", () => {
  it("says days and the nights one fewer, a day trip in days alone", () => {
    expect(durationWords(5, t)).toBe("5 gün • 4 gece")
    expect(durationWords(2, t)).toBe("2 gün • 1 gece")
    expect(durationWords(1, t)).toBe("1 gün")
  })

  it("says nothing of anything but a whole number of days from 1 to 365", () => {
    for (const days of [undefined, null, 0, -1, 2.5, 366, "5", Number.NaN]) {
      expect(durationWords(days, t)).toBeNull()
    }
  })
})
