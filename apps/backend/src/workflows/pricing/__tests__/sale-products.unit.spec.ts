import type { MedusaContainer } from "@medusajs/framework/types"
import { kurus } from "../../../lib/money"
import { priceDisplays } from "../price-display"
import { isAnythingOnSale, productsShown, saleProductIds } from "../sale-products"

jest.mock("../price-display", () => ({ priceDisplays: jest.fn() }))

const shown = (on_sale: boolean, lira: number) => ({ on_sale, current: kurus(lira * 100) })

afterEach(() => {
  jest.resetAllMocks()
})

/** `/kampanyalar` (adr/0023 Ek 2026-11-05): the same display the storefront's price comes from. */
describe("how products' prices are shown when indexed", () => {
  const container = {} as MedusaContainer

  it("asks the price read for every variant in the shop's currency, and marks those it shows as a discount", async () => {
    jest.mocked(priceDisplays).mockResolvedValue(
      new Map([
        // A price list's sale
        ["variant_a1", shown(true, 80)],
        // An automatic promotion every shopper gets
        ["variant_b1", shown(true, 70)],
        // A promotion on a price raised since it began: the price-before rule shows no discount
        ["variant_c1", shown(false, 140)],
      ]) as never
    )
    const found = await productsShown(container, [
      { id: "prod_a", variant_ids: ["variant_a1", "variant_a2"] },
      { id: "prod_b", variant_ids: ["variant_b1"] },
      { id: "prod_c", variant_ids: ["variant_c1"] },
      { id: "prod_d", variant_ids: [] },
    ])
    expect(Object.fromEntries(found)).toEqual({
      prod_a: { on_sale: true, lowest: 8000 },
      prod_b: { on_sale: true, lowest: 7000 },
      prod_c: { on_sale: false, lowest: 14000 },
    })
    expect(priceDisplays).toHaveBeenCalledTimes(1)
    expect(jest.mocked(priceDisplays).mock.calls[0]?.slice(1)).toEqual([
      ["variant_a1", "variant_a2", "variant_b1", "variant_c1"],
      "try",
    ])
  })

  it("reads nothing for products without variants", async () => {
    expect((await productsShown(container, [{ id: "prod_a", variant_ids: [] }])).size).toBe(0)
    expect(priceDisplays).not.toHaveBeenCalled()
  })
})

describe("the sale listing read from the search index", () => {
  const listing = jest.fn()
  const container = { resolve: () => ({ listing }) } as unknown as MedusaContainer

  it("is the index's on-sale rows, newest first, in any channel: never a scan of the catalogue", async () => {
    listing.mockResolvedValue({ ids: ["prod_b", "prod_a"], count: 2 })
    expect(await saleProductIds(container, 24)).toEqual(["prod_b", "prod_a"])
    expect(listing).toHaveBeenLastCalledWith(
      expect.objectContaining({
        channels: null,
        scope: { on_sale: true },
        sort: "newest",
        page: { offset: 0, limit: 24 },
      })
    )

    listing.mockResolvedValue({ ids: [], count: 0 })
    expect(await isAnythingOnSale(container)).toBe(false)
    expect(listing).toHaveBeenLastCalledWith(expect.objectContaining({ countOnly: true }))
  })
})
