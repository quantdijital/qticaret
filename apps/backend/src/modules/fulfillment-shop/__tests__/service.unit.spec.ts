import type { CalculateShippingOptionPriceContext } from "@medusajs/framework/types"
import ShopFulfillmentService from "../service"

const context = (quote?: unknown) =>
  ({
    items: [{ quantity: 1, variant: { weight: 500 } }],
    ...(quote === undefined ? {} : { qt_shipping: quote }),
  }) as unknown as CalculateShippingOptionPriceContext

describe("the shop's own delivery at a flat price (shop_shop, adr/0087 §2)", () => {
  const provider = new ShopFulfillmentService()
  const option = { id: "shop-flat", amount: 5_990 }

  it("charges the option's amount, KDV in", async () => {
    await expect(provider.calculatePrice(option, {}, context())).resolves.toEqual({
      calculated_amount: 59.9,
      is_calculated_price_tax_inclusive: true,
    })
    await expect(
      provider.calculatePrice(option, {}, context({ threshold: 20_000, item_total: 19_999 }))
    ).resolves.toMatchObject({ calculated_amount: 59.9 })
  })

  it("is free for a basket of free products, in full for a mixed one, with a class's surcharge (adr/0087)", async () => {
    const items = (classes: Record<string, string>) =>
      ({
        items: [
          { product_id: "prod_a", quantity: 1 },
          { product_id: "prod_b", quantity: 1 },
        ],
        qt_shipping: {
          threshold: null,
          item_total: 1_000,
          classes,
          surcharges: { bulky: 15_000 },
        },
      }) as unknown as CalculateShippingOptionPriceContext
    await expect(
      provider.calculatePrice(option, {}, items({ prod_a: "free", prod_b: "free" }))
    ).resolves.toMatchObject({ calculated_amount: 0 })
    await expect(
      provider.calculatePrice(option, {}, items({ prod_a: "free" }))
    ).resolves.toMatchObject({ calculated_amount: 59.9 })
    await expect(
      provider.calculatePrice(option, {}, items({ prod_a: "free", prod_b: "bulky" }))
    ).resolves.toMatchObject({ calculated_amount: 209.9 })
  })

  it("is free past the threshold", async () => {
    await expect(
      provider.calculatePrice(option, {}, context({ threshold: 20_000, item_total: 20_000 }))
    ).resolves.toMatchObject({ calculated_amount: 0 })
  })

  it("refuses an option without a sound amount, and takes nothing a shopper sends", async () => {
    for (const amount of [undefined, -1, 1.5, "5990", null]) {
      await expect(
        provider.calculatePrice({ id: "shop-flat", amount }, {}, context())
      ).rejects.toThrow()
    }
    // The method's own data never prices it
    await expect(
      provider.calculatePrice(option, { amount: 0, qt_shipping: { threshold: 0 } }, context())
    ).resolves.toMatchObject({ calculated_amount: 59.9 })
    await expect(provider.validateFulfillmentData({ id: "shop-flat" })).resolves.toEqual({
      option: "shop-flat",
    })
  })

  it("calculates its own option only, and opens nothing anywhere", async () => {
    await expect(provider.canCalculate({ data: { id: "shop-flat" } } as never)).resolves.toBe(true)
    await expect(provider.canCalculate({ data: { id: "aras-flat" } } as never)).resolves.toBe(false)
    await expect(provider.createFulfillment()).resolves.toEqual({ data: {}, labels: [] })
  })
})
