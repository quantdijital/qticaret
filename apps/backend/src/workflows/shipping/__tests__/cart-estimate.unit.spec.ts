import { pricerOf } from "../cart-estimate"

/**
 * The cart estimate prices the main option on the same keys its provider's
 * `calculatePrice` does (security review 2026-11-26): never a flat figure
 * where checkout charges the table, never a guess where Medusa prices it.
 */
describe("the main option's pricer before an address", () => {
  const option = (provider_id: string, data: Record<string, unknown>, price_type = "calculated") =>
    pricerOf({ provider_id, price_type, data })

  it("takes our flat amount per order, for the shop's own and the contracts' -flat", async () => {
    const own = option("shop_shop", { id: "shop-flat", amount: 9_000 })
    expect(own?.basis).toBe("order")
    expect(await own?.price([])).toBe(9_000)
    expect(option("aras_aras", { id: "aras-flat", amount: 5_000 })?.basis).toBe("order")
    expect(option("yurtici_yurtici", { id: "yurtici-flat", amount: 5_000 })?.basis).toBe("order")
  })

  it("prices the contracts' table by the parcel, a leftover amount ignored", () => {
    expect(option("aras_aras", { id: "aras-table", amount: 1 })?.basis).toBe("parcel")
    expect(option("yurtici_yurtici", { id: "yurtici-table" })?.basis).toBe("parcel")
  })

  it("leaves Medusa's own prices and unknown providers to the checkout", () => {
    expect(option("manual_manual", { amount: 9_000 }, "flat")).toBeNull()
    expect(option("other_other", { id: "x", amount: 9_000 })).toBeNull()
    expect(pricerOf(null)).toBeNull()
  })

  it("refuses a flat option without a readable amount (the caller says checkout)", () => {
    expect(() => option("shop_shop", { id: "shop-flat", amount: -1 })).toThrow()
  })
})
