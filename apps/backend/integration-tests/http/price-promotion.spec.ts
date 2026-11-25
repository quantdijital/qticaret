import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

interface Display {
  current: string
  regular: string
  before: string | null
  on_sale: boolean
  basis: string | null
  rule_version: string
  cart_offer: { type: string; value: number | string; minimum: string | null } | null
}

/**
 * adr/0023 Ek 2026-11-05: an automatic promotion every shopper gets is
 * the price before the cart, so the card, the page, the structured data
 * and the cart agree; one past a cart minimum is named beside the price;
 * a code's, a customer group's and another product's stay in the cart.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
    })

    // As the panel makes them (features/promotions/offer.ts)
    const promotion = async (body: Record<string, unknown>) => {
      const made = await settle(
        http.post<{ promotion: { id: string } }>(
          "/admin/promotions",
          { type: "standard", is_tax_inclusive: true, status: "active", ...body },
          { headers: admin.headers }
        )
      )
      expect({ status: made.status, body: made.data }).toMatchObject({ status: 200 })
      return made.data.promotion.id
    }
    const percent = (value: number, rules: Record<string, unknown>[] = []) => ({
      type: "percentage",
      target_type: rules.length > 0 ? "items" : "order",
      allocation: "across",
      value,
      ...(rules.length > 0 ? { target_rules: rules } : {}),
    })

    const display = async (variantId: string): Promise<Display | undefined> => {
      const read = await settle(
        http.get<{ price_display: Record<string, Display> }>(
          `/store/price-display?variant_id=${variantId}&currency_code=try`,
          { headers: store.headers }
        )
      )
      expect(read.status).toBe(200)
      return read.data.price_display[variantId]
    }

    // What a guest's cart of one unit charges for its items
    async function cartItems(variantId: string): Promise<number> {
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
          items: [{ variant_id: variantId, quantity: 1 }],
        },
      })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["item_total"], filters: { id: cart.id } })
      return Math.round(Number((data[0] as { item_total: unknown }).item_total) * 100) / 100
    }

    it("shows an automatic promotion every shopper gets as the price the cart charges", async () => {
      const settings =
        getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      await settings.saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      try {
        const { variantId } = await stockedProduct(getContainer(), shop, "kampanya-oto", 5, 1749)
        await promotion({ code: "SEPET30", is_automatic: true, application_method: percent(30) })

        expect(await display(variantId)).toMatchObject({
          current: "1224.30",
          regular: "1749.00",
          before: "1749.00",
          on_sale: true,
          rule_version: "tr-10d-1",
          cart_offer: null,
        })
        expect(await cartItems(variantId)).toBe(1224.3)
        // The page's structured data offers the same price, the same struck one
        const page = await settle(
          http.get<{ seo?: { jsonLd: Record<string, unknown>[] } }>(
            `/store/seo/resolve?path=${encodeURIComponent("/urun/kampanya-oto")}`,
            { headers: store.headers }
          )
        )
        const product = page.data.seo?.jsonLd.find((block) => block["@type"] === "Product")
        expect(product?.["offers"]).toMatchObject({
          price: "1224.30",
          priceSpecification: { price: "1749.00" },
        })
      } finally {
        // The settings cache outlives the database reset between tests
        await settings.saveSection("seo", { canonical_host: null }, null)
      }
    })

    it("names a promotion past a cart minimum beside the price and leaves the price alone", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "kampanya-esik", 5, 1749)
      await promotion({
        code: "ESIK10",
        is_automatic: true,
        rules: [{ attribute: "item_total", operator: "gte", values: ["2000"] }],
        application_method: percent(10),
      })
      expect(await display(variantId)).toMatchObject({
        current: "1749.00",
        before: null,
        on_sale: false,
        cart_offer: { type: "percentage", value: 10, minimum: "2000.00" },
      })
      // One unit is under the minimum: the cart agrees
      expect(await cartItems(variantId)).toBe(1749)
    })

    it("keeps a code's, a customer group's and another product's promotion in the cart", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "kampanya-yok", 5, 1000)
      const other = await stockedProduct(getContainer(), shop, "kampanya-diger", 5, 1000)
      const [group] = await getContainer()
        .resolve(Modules.CUSTOMER)
        .createCustomerGroups([{ name: "Toptan" }])
      await promotion({ code: "KOD20", is_automatic: false, application_method: percent(20) })
      await promotion({
        code: "GRUP15",
        is_automatic: true,
        rules: [{ attribute: "customer.groups.id", operator: "in", values: [group?.id ?? ""] }],
        application_method: percent(15),
      })
      const target = [{ attribute: "items.product.id", operator: "in", values: [other.productId] }]
      await promotion({
        code: "URUN25",
        is_automatic: true,
        application_method: percent(25, target),
      })

      expect(await display(variantId)).toMatchObject({
        current: "1000.00",
        on_sale: false,
        cart_offer: null,
      })
      expect(await display(other.variantId)).toMatchObject({ current: "750.00", on_sale: true })
      expect(await cartItems(variantId)).toBe(1000)
      expect(await cartItems(other.variantId)).toBe(750)
    })

    // adr/0076 Ek 2026-11-25: a budget may run out between the card and the cart
    it("shows no campaign with a budget before the cart, which still applies it", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "kampanya-butce", 5, 1000)
      const budgeted = async (identifier: string, budget: Record<string, unknown>) =>
        (
          await http.post<{ campaign: { id: string } }>(
            "/admin/campaigns",
            { name: identifier, campaign_identifier: identifier, budget },
            { headers: admin.headers }
          )
        ).data.campaign.id
      await promotion({
        code: "BUTCE30",
        is_automatic: true,
        campaign_id: await budgeted("butce", {
          type: "spend",
          limit: 50_000,
          currency_code: "try",
        }),
        application_method: { ...percent(30), currency_code: "try" },
      })
      expect(await display(variantId)).toMatchObject({
        current: "1000.00",
        before: null,
        on_sale: false,
        cart_offer: null,
      })
      expect(await cartItems(variantId)).toBe(700)

      // One with a count of uses beside one with no budget: only the latter, on the whole price
      const other = await stockedProduct(getContainer(), shop, "kampanya-karma", 5, 1000)
      const target = [{ attribute: "items.product.id", operator: "in", values: [other.productId] }]
      await promotion({
        code: "ADET40",
        is_automatic: true,
        campaign_id: await budgeted("adet", { type: "usage", limit: 100 }),
        application_method: percent(40, target),
      })
      await promotion({
        code: "OTO10",
        is_automatic: true,
        application_method: percent(10, target),
      })
      expect(await display(other.variantId)).toMatchObject({
        current: "900.00",
        before: "1000.00",
        on_sale: true,
      })
      // The cart gives both (the budgeted one alone would be 600): never more than the card said
      expect(await cartItems(other.variantId)).toBeLessThan(600)
    })

    it("waits for a promotion's campaign to begin", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "kampanya-yarin", 5, 1000)
      const campaign = await http.post<{ campaign: { id: string } }>(
        "/admin/campaigns",
        {
          name: "Yarın",
          campaign_identifier: "yarin",
          starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { headers: admin.headers }
      )
      await promotion({
        code: "YARIN30",
        is_automatic: true,
        campaign_id: campaign.data.campaign.id,
        application_method: percent(30),
      })
      expect(await display(variantId)).toMatchObject({ current: "1000.00", on_sale: false })
      expect(await cartItems(variantId)).toBe(1000)
    })
  },
})
