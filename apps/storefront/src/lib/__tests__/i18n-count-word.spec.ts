import { describe, expect, it } from "vitest"
import { t, withCountWord } from "@/lib/i18n"

/**
 * A product count in the shop's own word (`listing_page.count_word`):
 * the category tiles and the menu say "4 tur" as the listing page does.
 */
describe("withCountWord", () => {
  it("says the shop's word for every product count, the other words as they are", () => {
    const words = withCountWord("tur")
    expect(words("listing.count", { count: "4" })).toBe("4 tur")
    expect(words("cart.item_count", { count: 2 })).toBe(t("cart.item_count", { count: 2 }))
  })

  it("is today's words while the shop writes none", () => {
    expect(withCountWord(null)).toBe(t)
    expect(withCountWord("")("listing.count", { count: 4 })).toBe("4 ürün")
  })
})
