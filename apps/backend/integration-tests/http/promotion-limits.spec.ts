import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { checkout } from "../helpers/gift-cards"
import type { HttpClient } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(240 * 1000)

/** F4.4 (ADR-0024): a per-customer limit, for members and guests alike. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let variantId: string

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, "kisi-basi", 50, 100)).variantId
      const campaign = await http.post<{ campaign: { id: string } }>(
        "/admin/campaigns",
        {
          name: "Kişi başı bir",
          campaign_identifier: "kisi-basi-bir",
          budget: { type: "use_by_attribute", attribute: "customer_id", limit: 1 },
        },
        { headers: admin.headers }
      )
      await http.post(
        "/admin/promotions",
        {
          code: "KISI",
          type: "standard",
          is_automatic: false,
          is_tax_inclusive: true,
          status: "active",
          campaign_id: campaign.data.campaign.id,
          application_method: {
            type: "percentage",
            target_type: "order",
            allocation: "across",
            value: 10,
          },
        },
        { headers: admin.headers }
      )
    })

    // A guest's order with the code; what the cart took off
    async function orderAs(email: string): Promise<number> {
      const address = {
        first_name: "Ayşe",
        last_name: "Yılmaz",
        address_1: "Demo",
        country_code: "tr",
      }
      const { result } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          email,
          items: [{ variant_id: variantId, quantity: 1 }],
          promo_codes: ["KISI"],
          shipping_address: address,
          billing_address: address,
        },
      })
      await addShippingMethodToCartWorkflow(getContainer()).run({
        input: { cart_id: result.id, options: [{ id: shop.shippingOptionId }] },
      })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["discount_total"], filters: { id: result.id } })
      await checkout(getContainer(), result.id)
      return Number((data[0] as { discount_total: unknown }).discount_total)
    }

    it("gives a guest the code once, however the e-mail is written", async () => {
      // Medusa ties a guest's carts to one guest customer by e-mail, in any case
      expect(await orderAs("ayse@example.com")).toBe(10)
      expect(await orderAs("ayse@example.com")).toBe(0)
      expect(await orderAs("AYSE@Example.com")).toBe(0)
      expect(await orderAs("mehmet@example.com")).toBe(10)
    })
  },
})
