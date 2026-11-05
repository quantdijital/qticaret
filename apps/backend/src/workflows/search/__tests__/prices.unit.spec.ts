import { kurus } from "../../../lib/money"
import { withShownPrice } from "../prices"

/** adr/0023 Ek 2026-11-05: a listing filters and sorts by the price its cards show. */
describe("a product's prices in the search index", () => {
  const regions = { "reg_tr:try": 1749, "reg_eu:eur": 49.9 }

  it("puts the shown price (an automatic promotion included) in the shop's currency", () => {
    expect(withShownPrice(regions, { on_sale: true, lowest: kurus(122430) })).toEqual({
      "reg_tr:try": 1224.3,
      "reg_eu:eur": 49.9,
    })
  })

  it("keeps Medusa's prices without a shown one", () => {
    expect(withShownPrice(regions, undefined)).toEqual(regions)
    expect(withShownPrice(regions, { on_sale: false, lowest: null })).toEqual(regions)
    // No region in the currency: nothing to put it under
    expect(withShownPrice({}, { on_sale: true, lowest: kurus(100) })).toEqual({})
  })
})
