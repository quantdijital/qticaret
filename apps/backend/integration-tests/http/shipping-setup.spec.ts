import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { geliverOrder, geliverShop, shipOrder } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

interface ShopOption {
  id: string
  name: string
  carrier: string | null
  pricing: string
  amount: string | null
  in_store: boolean
}

/** F7.8: the shop's shipping options and price table, kept from the panel. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop
    let storefront: Storefront

    const send = <T>(method: "post" | "delete", path: string, body?: unknown) =>
      settle(
        method === "post"
          ? http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers })
          : http.delete<T & { message?: string }>(path, { headers: setup.admin.headers })
      )
    const options = async () =>
      (
        await http.get<{ options: ShopOption[] }>("/admin/shipping-setup/options", {
          headers: setup.admin.headers,
        })
      ).data.options
    const calculate = async (optionId: string) => {
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: setup.shop.regionId,
          sales_channel_id: setup.shop.salesChannelId,
          currency_code: "try",
          items: [{ variant_id: setup.variantId, quantity: 1 }],
          shipping_address: PAYTR_ADDRESS,
        },
      })
      return settle(
        http.post<{ shipping_option: { amount: number }; message?: string }>(
          `/store/shipping-options/${optionId}/calculate`,
          { cart_id: cart.id, data: {} },
          { headers: storefront.headers }
        )
      )
    }

    beforeAll(async () => {
      fake = await startFakeGeliver()
      process.env["GELIVER_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["GELIVER_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      storefront = await createStorefront(getContainer())
      setup = await geliverShop(http, getContainer(), fake)
    })

    it("adds, reprices and removes a flat option the shop ships itself", async () => {
      const created = await send<{ id: string }>("post", "/admin/shipping-setup/options", {
        name: "Hızlı Kargo",
        carrier: "manual",
        pricing: { type: "flat", amount: 49.9 },
      })
      const listed = (await options()).find(({ id }) => id === created.data.id)
      await send("post", `/admin/shipping-setup/options/${created.data.id}`, {
        name: "Hızlı Kargo (1 gün)",
        amount: 59.9,
      })
      const changed = (await options()).find(({ id }) => id === created.data.id)
      await send("delete", `/admin/shipping-setup/options/${created.data.id}`)
      const gone = (await options()).find(({ id }) => id === created.data.id)

      expect(listed).toMatchObject({
        carrier: "manual",
        pricing: "flat",
        amount: "49.90",
        in_store: true,
      })
      expect(changed).toMatchObject({ name: "Hızlı Kargo (1 gün)", amount: "59.90" })
      expect(gone).toBeUndefined()
    })

    it("adds an option at the shop's only warehouse when none was picked as the default", async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: stores } = await query.graph({ entity: "store", fields: ["id"] })
      const storeId = (stores[0] as { id: string }).id
      const { data: locations } = await query.graph({ entity: "stock_location", fields: ["id"] })
      await container.resolve(Modules.STORE).updateStores(storeId, { default_location_id: null })

      const created = await send<{ id: string }>("post", "/admin/shipping-setup/options", {
        name: "Ekonomik Kargo",
        carrier: "manual",
        pricing: { type: "flat", amount: 39.9 },
      })
      const { data: placed } = await query.graph({
        entity: "shipping_option",
        fields: ["service_zone.fulfillment_set.location.id"],
        filters: { id: created.data.id },
      })
      await container
        .resolve(Modules.STORE)
        .updateStores(storeId, { default_location_id: setup.shop.locationId })

      expect(locations).toHaveLength(1)
      expect(created.status).toBe(200)
      expect(
        (placed[0] as { service_zone: { fulfillment_set: { location: { id: string } } } })
          .service_zone.fulfillment_set.location.id
      ).toBe(setup.shop.locationId)
    })

    it("keeps an option orders still to ship need, and lets it go once they left", async () => {
      const orderId = await geliverOrder(getContainer(), setup)

      const kept = await send("delete", `/admin/shipping-setup/options/${setup.optionId}`)
      await shipOrder(http, setup, orderId)
      const gone = await send("delete", `/admin/shipping-setup/options/${setup.optionId}`)

      expect(kept.data.message).toBe("shipping.option_in_use")
      expect(gone.status).toBe(200)
      expect((await options()).find(({ id }) => id === setup.optionId)).toBeUndefined()
    })

    it("prices a Geliver option by the shop's table, and says when the parcel is past it", async () => {
      const created = await send<{ id: string }>("post", "/admin/shipping-setup/options", {
        name: "Standart",
        carrier: "geliver",
        pricing: { type: "table" },
      })

      const noTable = await calculate(created.data.id)
      await send("post", "/admin/platform-settings/shipping", {
        rate_table: [
          { max_desi: 2, price: 4_990 },
          { max_desi: 10, price: 8_990 },
        ],
      })
      const priced = await calculate(created.data.id)

      expect(noTable.data.message).toBe("shipping.no_rate")
      // The 1 desi parcel falls in the first band
      expect(priced.data.shipping_option.amount).toBe(49.9)
      expect((await options()).find(({ id }) => id === created.data.id)).toMatchObject({
        carrier: "geliver",
        pricing: "table",
        amount: null,
      })
    })

    it("offers pickup from the shop, free, in a pickup zone of its own", async () => {
      const created = await send<{ id: string }>("post", "/admin/shipping-setup/options", {
        name: "Mağazadan teslim al",
        carrier: "pickup",
        pricing: { type: "flat", amount: 0 },
      })
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: setup.shop.regionId,
          sales_channel_id: setup.shop.salesChannelId,
          currency_code: "try",
          items: [{ variant_id: setup.variantId, quantity: 1 }],
          shipping_address: PAYTR_ADDRESS,
        },
      })
      await addShippingMethodToCartWorkflow(getContainer()).run({
        input: { cart_id: cart.id, options: [{ id: created.data.id }] },
      })
      const { data } = await http.get<{ cart: { shipping_methods: { amount: number }[] } }>(
        `/store/carts/${cart.id}`,
        { headers: storefront.headers }
      )

      expect((await options()).find(({ id }) => id === created.data.id)).toMatchObject({
        carrier: "pickup",
        pricing: "flat",
        amount: "0.00",
      })
      expect(data.cart.shipping_methods).toEqual([expect.objectContaining({ amount: 0 })])
    })

    it("refuses a quote for a parcel the shop ships itself, and days that do not add up", async () => {
      const manualQuote = await send("post", "/admin/shipping-setup/options", {
        name: "Elden",
        carrier: "manual",
        pricing: { type: "quote", choice: "cheapest" },
      })
      const days = await send("post", "/admin/platform-settings/shipping", {
        handling_days_min: 3,
        handling_days_max: 1,
      })
      const bands = await send("post", "/admin/platform-settings/shipping", {
        rate_table: [
          { max_desi: 5, price: 100 },
          { max_desi: 2, price: 50 },
        ],
      })

      expect(manualQuote.data.message).toBe("shipping.manual_flat_only")
      expect(days.status).toBe(400)
      expect(JSON.stringify(days.data)).toMatch(/shipping\.days_order/)
      expect(JSON.stringify(bands.data)).toMatch(/shipping\.rate_table_order/)
    })
  },
})
