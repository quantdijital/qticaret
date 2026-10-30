import { randomBytes } from "node:crypto"
import type { ICustomerModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { DEMO_SHOPIFY, startFakeShopify } from "@qticaret/testing"
import type { FakeShopify } from "@qticaret/testing"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"

jest.setTimeout(600 * 1000)

type Counts = Record<string, Record<string, number>>

/** F14.2 (adr/0042 §10; KK1 with the fake): a Shopify store moved here through its bulk files. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const app = { clientId: "test-shopify-app-0001", clientSecret: randomBytes(16).toString("hex") }
    let shopify: FakeShopify
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const { settled } = sheetClient(http, getContainer, () => owner.headers)

    const connect = (secret = app.clientSecret) =>
      settle(
        http.post<{ message?: string }>(
          "/admin/integrations/credentials/shopify",
          {
            settings: { shop_domain: "demo-magaza.myshopify.com", client_id: app.clientId },
            secrets: { client_secret: secret },
          },
          { headers: owner.headers }
        )
      )
    const start = (body: Record<string, unknown>) =>
      settle(
        http.post<{ async_job: SheetJob; message?: string }>("/admin/migrations/shopify", body, {
          headers: owner.headers,
        })
      )
    const run = async (body: Record<string, unknown>) => {
      const queued = await start(body)
      expect(queued.status).toBe(202)
      return settled(queued.data.async_job.id)
    }

    beforeAll(async () => {
      shopify = await startFakeShopify(app, { data: structuredClone(DEMO_SHOPIFY) })
      process.env["SHOPIFY_BASE_URL"] = shopify.url
    })

    afterAll(async () => {
      Reflect.deleteProperty(process.env, "SHOPIFY_BASE_URL")
      await shopify.close()
    })

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      await stockShop(getContainer())
      shopify.refuseShop(false)
      shopify.data.currencyCode = "TRY"
    })

    it("connects the owner's app, refusing a wrong secret and another organization's store", async () => {
      const unconnected = await start({ mode: "check" })
      expect(unconnected.status).toBe(400)
      expect(unconnected.data.message).toBe("migration.shopify_not_connected")

      expect((await connect("yanlis-gizli-anahtar")).status).toBe(400)
      shopify.refuseShop(true)
      expect((await connect()).status).toBe(400)
      shopify.refuseShop(false)
      expect((await connect()).status).toBe(200)
    })

    it("checks, applies with the owner's parcel and applies again without making anything twice", async () => {
      expect((await connect()).status).toBe(200)
      const checked = await run({ mode: "check" })
      expect(checked.status).toBe("succeeded")
      expect((checked.result_summary as { counts: Counts }).counts).toMatchObject({
        category: { read: 2, created: 2 },
        brand: { read: 1, created: 1 },
        product: { read: 2, created: 2, failed: 0 },
        customer: { read: 2, created: 2 },
        consent: { created: 1 },
        order: { read: 2, created: 2 },
        review: { read: 0 },
        page: { read: 3 },
      })
      expect(shopify.bulkRuns).toEqual([
        "collections",
        "products",
        "customers",
        "orders",
        "pages",
        "blogs",
      ])

      const parcel = { weight: 500, length: 30, width: 20, height: 10 }
      const applied = await run({ mode: "apply", defaults: parcel })
      expect(applied.status).toBe("succeeded")
      const { data: products } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: ["handle", "status", "weight", "length", "brand.name"],
          filters: { handle: ["dokum-tava", "ahsap-kasik"] },
        })
      // The pan's own weight, the owner's measurements; the draft stays a draft
      expect(
        (products as { handle: string; status: string; weight: number; length: number }[])
          .map((product) => [product.handle, product.status, product.weight, product.length])
          .sort()
      ).toEqual([
        ["ahsap-kasik", "draft", 50, 30],
        ["dokum-tava", "published", 1500, 30],
      ])

      const [ayse] = await getContainer()
        .resolve<ICustomerModuleService>(Modules.CUSTOMER)
        .listCustomers({ email: "ayse.shopify@example.com" }, { relations: ["addresses"] })
      expect(ayse?.addresses.map((address) => address.city)).toEqual(["Kadıköy"])
      const consents = await getContainer()
        .resolve<MessagingModuleService>(MESSAGING_MODULE)
        .listMessageConsents({ customer_id: ayse?.id ?? "" })
      expect(consents.map((consent) => [consent.channel, consent.status])).toEqual([
        ["email", "granted"],
      ])
      const migration = getContainer().resolve<MigrationModuleService>(MIGRATION_MODULE)
      const orders = await migration.listLegacyOrders({}, { order: { number: "ASC" } })
      expect(orders.map((order) => [order.number, order.status, order.customer_id])).toEqual([
        ["#1001", "Gönderildi", ayse?.id],
        ["#1002", "İptal edildi", null],
      ])
      const pages = await migration.listMigrationItems({ kind: "page" })
      expect(pages.map((page) => page.old_url).sort()).toEqual([
        "/blogs/haberler",
        "/blogs/haberler/tava-bakimi",
        "/pages/hakkimizda",
      ])
      expect(pages[0]?.source).toBe("shopify:demo-magaza.myshopify.com")

      const again = await run({ mode: "apply", defaults: parcel })
      expect((again.result_summary as { counts: Counts }).counts).toMatchObject({
        category: { created: 0, found: 2 },
        product: { created: 0, failed: 0 },
        customer: { created: 0, found: 2 },
        order: { created: 0, found: 2 },
      })
      expect(await migration.listLegacyOrders({})).toHaveLength(2)
    })

    it("refuses a store that sells in another currency before reading it", async () => {
      expect((await connect()).status).toBe(200)
      shopify.data.currencyCode = "USD"
      const runs = shopify.bulkRuns.length
      const job = await run({ mode: "check" })
      expect(job.status).toBe("failed")
      expect(shopify.bulkRuns).toHaveLength(runs)
    })
  },
})
