import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(240 * 1000)

/**
 * F4.5 (ADR-0024): the offers the panel makes, as Medusa applies them.
 * The bodies are the ones the panel sends (features/promotions/offer.ts).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
    })

    const promotion = async (body: Record<string, unknown>) => {
      const made = await settle(
        http.post(
          "/admin/promotions",
          { type: "standard", is_tax_inclusive: true, status: "active", ...body },
          { headers: admin.headers }
        )
      )
      expect({ status: made.status, body: made.data }).toMatchObject({ status: 200 })
    }

    // The discount a basket of `items` gets, with `codes`
    async function discount(
      items: { variant_id: string; quantity: number }[],
      codes: string[] = []
    ): Promise<number> {
      const address = {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        address_1: "Demo",
        country_code: "tr",
      }
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          items,
          promo_codes: codes,
          shipping_address: address,
          billing_address: address,
        },
      })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["discount_total"], filters: { id: cart.id } })
      // Medusa's exact amount, to the kuruş
      return Math.round(Number((data[0] as { discount_total: unknown }).discount_total) * 100) / 100
    }

    it("gives buy 3, pay 2: the cheapest of every three free, again as the basket grows", async () => {
      const cup = await stockedProduct(getContainer(), shop, "uc-al-a", 50, 100)
      const plate = await stockedProduct(getContainer(), shop, "uc-al-b", 50, 60)
      const rules = [
        { attribute: "items.product.id", operator: "in", values: [cup.productId, plate.productId] },
      ]
      await promotion({
        code: "UCAL",
        type: "buyget",
        is_automatic: false,
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          value: 100,
          max_quantity: 1000,
          apply_to_quantity: 1,
          buy_rules_min_quantity: 2,
          buy_rules: rules,
          target_rules: rules,
        },
      })
      const cups = (quantity: number) => [{ variant_id: cup.variantId, quantity }]
      expect(await discount(cups(2), ["UCAL"])).toBe(0)
      expect(await discount(cups(3), ["UCAL"])).toBe(100)
      expect(await discount(cups(6), ["UCAL"])).toBe(200)
      // Two cups and a plate: the plate, the cheapest, is free
      expect(
        await discount([...cups(2), { variant_id: plate.variantId, quantity: 1 }], ["UCAL"])
      ).toBe(60)
    })

    it("takes a basket discount on its own from a basket total", async () => {
      const cup = await stockedProduct(getContainer(), shop, "sepette", 50, 100)
      await promotion({
        code: "SEPET",
        is_automatic: true,
        rules: [{ attribute: "item_total", operator: "gte", values: ["250"] }],
        application_method: {
          type: "percentage",
          target_type: "order",
          allocation: "across",
          value: 10,
        },
      })
      expect(await discount([{ variant_id: cup.variantId, quantity: 2 }])).toBe(0)
      expect(await discount([{ variant_id: cup.variantId, quantity: 3 }])).toBe(30)
    })
  },
})
