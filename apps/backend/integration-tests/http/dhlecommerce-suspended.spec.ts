import { addShippingMethodToCartWorkflow, createCartWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeDhlEcom } from "@qticaret/testing"
import type { FakeDhlEcom } from "@qticaret/testing"
import { ensureLocationCarriers } from "../../src/scripts/bootstrap/location-carriers"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { measuredProduct } from "../helpers/carrier"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const SWITCH = "CARRIER_DHLECOMMERCE_ENABLED"
const ENV = ["DHL_ECOMMERCE_BASE_URL", "DHL_ECOMMERCE_CLIENT_ID", "DHL_ECOMMERCE_CLIENT_SECRET"]

/**
 * DHL eCommerce's app keys of the shop's own (the owner, 2026-11-26), and
 * its suspension (adr/0027 Ek 2026-11-26 "askı"): with the server switch
 * off, no screen names it, its account routes answer 404 and checkout
 * offers none of its options. The test run turns the switch on
 * (`integration-tests/setup.js`); here it is turned off for one test.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeDhlEcom
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let variantId: string

    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: admin.headers }))
    const get = <T>(path: string) => settle(http.get<T>(path, { headers: admin.headers }))
    const connect = (secrets: Record<string, string>) =>
      post<{ check: string }>("/admin/integrations/credentials/dhlecommerce", {
        settings: { test_mode: true },
        secrets,
      })
    const withSwitchOff = async (run: () => Promise<void>) => {
      const kept = process.env[SWITCH]
      process.env[SWITCH] = "false"
      try {
        await run()
      } finally {
        process.env[SWITCH] = kept
      }
    }

    beforeAll(async () => {
      // DHL takes the shop's app alone; the platform's (the fake's development app, as
      // a server with a fake address and no keys has) is refused
      fake = await startFakeDhlEcom({
        clientId: "magaza-kendi-uygulamasi",
        clientSecret: "magaza-kendi-uygulama-sirri",
      })
      process.env["DHL_ECOMMERCE_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await ensureLocationCarriers(container)
      variantId = await measuredProduct(container, shop)
      fake.orders.clear()
    })

    it("connects and ships with the shop's own app keys in place of the platform's", async () => {
      const account = {
        customer_number: fake.account.customerNumber,
        password: fake.account.password,
      }
      const platformOnly = await connect(account)
      const own = await connect({
        ...account,
        client_id: fake.app.clientId,
        client_secret: fake.app.clientSecret,
      })
      const listed = await get<{
        accounts: { provider: string; secrets: Record<string, boolean> }[]
      }>("/admin/integrations/credentials")
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "DHL eCommerce",
        carrier: "dhlecommerce",
        pricing: { type: "flat", amount: 59.9 },
      })
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: created.data.id,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email: "ayse.yilmaz@example.com",
      })
      const shipped = await post(`/admin/orders/${orderId}/ship`, { notify: false })

      expect(platformOnly.data).toMatchObject({ message: "dhlecommerce.secret_invalid" })
      expect(own.status).toBe(200)
      expect(own.data.check).toBe("valid")
      // Masked as the password is: stored, never read back
      expect(
        listed.data.accounts.find(({ provider }) => provider === "dhlecommerce")?.secrets
      ).toEqual({ customer_number: true, password: true, client_id: true, client_secret: true })
      expect(JSON.stringify(listed.data)).not.toContain(fake.app.clientSecret)
      expect(shipped.status).toBe(200)
      expect(fake.orders.size).toBe(1)
    })

    it("hides DHL eCommerce everywhere and refuses it while the switch is off", async () => {
      const created = await post<{ id: string }>("/admin/shipping-setup/options", {
        name: "DHL eCommerce",
        carrier: "dhlecommerce",
        pricing: { type: "flat", amount: 59.9 },
      })
      const { result: cart } = await createCartWorkflow(getContainer()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: storefront.salesChannelId,
          currency_code: "try",
          email: "ayse.yilmaz@example.com",
          items: [{ variant_id: variantId, quantity: 1 }],
          shipping_address: PAYTR_ADDRESS,
        },
      })
      const offered = async () =>
        (
          await http.get<{ shipping_options: { id: string }[] }>(
            `/store/shipping-options?cart_id=${cart.id}`,
            { headers: storefront.headers }
          )
        ).data.shipping_options.map(({ id }) => id)
      expect(await offered()).toContain(created.data.id)

      await withSwitchOff(async () => {
        const carriers = await get<{ carriers: string[] }>("/admin/shipping-setup/carriers")
        const accounts = await get<{ accounts: { provider: string }[]; unavailable: string[] }>(
          "/admin/integrations/credentials"
        )
        const write = await connect({ customer_number: "123456", password: "kalici-sifre" })
        const check = await post("/admin/integrations/credentials/dhlecommerce/check", {})
        const overview = await get<{ integrations: { id: string }[] }>(
          "/admin/integrations/overview"
        )
        const options = await get<{ options: { id: string }[] }>("/admin/shipping-setup/options")
        const refused = await post("/admin/shipping-setup/options", {
          name: "DHL eCommerce 2",
          carrier: "dhlecommerce",
          pricing: { type: "table" },
        })
        const atCheckout = await offered()
        const added = await addShippingMethodToCartWorkflow(getContainer())
          .run({ input: { cart_id: cart.id, options: [{ id: created.data.id }] } })
          .then(
            () => null,
            (error: unknown) => error
          )

        expect(carriers.data.carriers).toEqual(["aras", "yurtici", "surat"])
        expect(accounts.data.accounts.map(({ provider }) => provider)).not.toContain("dhlecommerce")
        expect(accounts.data.unavailable).not.toContain("dhlecommerce")
        expect(write.status).toBe(404)
        expect(check.status).toBe(404)
        expect(overview.data.integrations.map(({ id }) => id)).not.toContain("dhlecommerce")
        expect(options.data.options.map(({ id }) => id)).not.toContain(created.data.id)
        expect(refused.status).toBe(400)
        expect(atCheckout).not.toContain(created.data.id)
        expect(added).toBeTruthy()
      })

      // Back on, it is as it was
      expect(await offered()).toContain(created.data.id)
    })
  },
})
