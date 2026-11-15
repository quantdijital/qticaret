import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { productCard } from "../product"
import { quickViewIdOf } from "../quick-view"

const PRODUCT = {
  id: "prod_01",
  title: "Katlanır Çakı",
  handle: "katlanir-caki",
  subtitle: null,
  description: null,
  thumbnail: null,
  variants: [],
} as unknown as StoreProduct

/** adr/0049 Ek 2026-11-15: the card carries only the button's look, and only while it is on. */
describe("a card's quick view", () => {
  it("carries the button's look while the shop has it on, nothing otherwise", () => {
    expect(productCard(PRODUCT, "/urun/katlanir-caki", {})).not.toHaveProperty("quickView")
    expect(
      productCard(
        PRODUCT,
        "/urun/katlanir-caki",
        {},
        { showBrand: true, showRating: false, quickView: null }
      )
    ).not.toHaveProperty("quickView")
    expect(
      productCard(
        PRODUCT,
        "/urun/katlanir-caki",
        {},
        { showBrand: true, showRating: false, quickView: "icon" }
      ).quickView
    ).toBe("icon")
  })

  it("reads the asked product id strictly", () => {
    const id = (query: string) => quickViewIdOf(new URLSearchParams(query))
    expect(id("id=prod_01JABC")).toBe("prod_01JABC")
    expect(id("")).toBeNull()
    expect(id("id=prod_")).toBeNull()
    expect(id("id=prod_01%2F..")).toBeNull()
    expect(id(`id=prod_${"a".repeat(65)}`)).toBeNull()
  })
})
