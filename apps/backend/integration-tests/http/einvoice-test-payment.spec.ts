import { randomBytes } from "node:crypto"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom, startFakeParasut } from "@qticaret/testing"
import type { FakeParasut } from "@qticaret/testing"
import { issueInvoices } from "../../src/jobs/einvoice-issue"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { queueSaleInvoice } from "../../src/workflows/einvoice/queue-invoices"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const ENV = ["PARASUT_CLIENT_ID", "PARASUT_CLIENT_SECRET", "PARASUT_BASE_URL"] as const
const minutesLater = (minutes: number) => new Date(Date.now() + minutes * 60_000)

interface OrderInvoices {
  invoices: { kind: string; status: string }[]
  sale_hold?: { reason: string; payment_provider: string | null } | null
}

/**
 * An order paid in a provider's test mode (adr/0034): the order page says
 * why it has no invoice; on a developer's machine with the fake Paraşüt
 * (NODE_ENV=test here, its address on this machine) it is invoiced all
 * the same, so the owner sees the whole flow.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const client = { clientId: "test-platform", clientSecret: randomBytes(16).toString("hex") }
    const user = { username: "test@example.com", password: randomBytes(16).toString("hex") }
    let parasut: FakeParasut
    let shop: StockShop
    let owner: { headers: Record<string, string> }
    let variantId: string

    const invoices = () => getContainer().resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    const invoiceOf = async (orderId: string) =>
      (await invoices().listInvoices({ order_id: orderId }))[0]
    const orderPage = async (orderId: string) =>
      (
        await http.get<OrderInvoices>(`/admin/invoices?order_id=${orderId}`, {
          headers: owner.headers,
        })
      ).data
    const order = () =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
    const paymentsOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["payment_collections.payments.id", "payment_collections.payments.data"],
          filters: { id: orderId },
        })
      return (
        data[0] as { payment_collections: { payments: { id: string; data: unknown }[] }[] }
      ).payment_collections.flatMap((collection) => collection.payments)
    }
    /** Marks the order's payment as taken in a provider's test mode, as PayTR's would be. */
    const inTestMode = async (orderId: string) => {
      const ids = (await paymentsOf(orderId)).map(({ id }) => id)
      // Our hosted-form providers keep it in the payment's data, which Medusa's update does not type
      await getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
        .raw(
          `update payment set data = coalesce(data, '{}'::jsonb) || '{"test_mode": true}'::jsonb where id = any(?)`,
          [ids]
        )
    }
    const stillTestMode = async (orderId: string) =>
      (await paymentsOf(orderId)).every(
        ({ data }) => (data as { test_mode?: unknown } | null)?.test_mode === true
      )
    const settings = (body: Record<string, unknown>) =>
      http.post("/admin/platform-settings/invoicing", body, { headers: owner.headers })

    beforeAll(async () => {
      parasut = await startFakeParasut(client, user)
      Object.assign(process.env, {
        PARASUT_CLIENT_ID: client.clientId,
        PARASUT_CLIENT_SECRET: client.clientSecret,
        PARASUT_BASE_URL: parasut.url,
      })
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await parasut.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      owner = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `odeme-${String(Date.now())}`, 10, 90))
        .variantId
    })

    it("tells the order page why a sale has no invoice: off, unpaid, a test payment", async () => {
      const orderId = await order()
      const off = await orderPage(orderId)
      await settings({ provider: "external", trigger: "placed" })
      const unpaid = await orderPage(orderId)
      await inTestMode(orderId)
      await advanceOrder(getContainer(), orderId, "to_ship")
      const queued = await queueSaleInvoice(getContainer(), orderId, "paid")
      const testPaid = await orderPage(orderId)
      const [payment] = await paymentsOf(orderId)
      const providerId = (
        await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "payment", fields: ["provider_id"], filters: { id: payment?.id ?? "" } })
      ).data[0] as { provider_id: string }

      expect(off).toMatchObject({ invoices: [], sale_hold: { reason: "off" } })
      expect(unpaid.sale_hold).toEqual({ reason: "awaiting_payment", payment_provider: null })
      expect(await stillTestMode(orderId)).toBe(true)
      expect(queued).toBe("not_due")
      expect(testPaid).toMatchObject({
        invoices: [],
        sale_hold: { reason: "test_payment", payment_provider: providerId.provider_id },
      })
    })

    it("invoices a test payment on a developer's machine with the fake Paraşüt", async () => {
      await http.post(
        "/admin/einvoice/parasut",
        { company_id: parasut.companyId, code: parasut.issueCode() },
        { headers: owner.headers }
      )
      await settings({
        provider: "parasut",
        trigger: "placed",
        carriers: { manual: { title: "Örnek Kargo A.Ş.", tax_id: fakeVkn(seededRandom(8)) } },
      })
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: owner.headers }
      )
      const orderId = await order()
      await inTestMode(orderId)
      await advanceOrder(getContainer(), orderId, "to_ship")
      const queued = await eventually(() => invoiceOf(orderId), Boolean)
      let issued = queued
      for (let minute = 0; minute < 12 && issued?.status !== "issued"; minute++) {
        await issueInvoices(getContainer(), minutesLater(minute * 2))
        issued = await invoiceOf(orderId)
      }
      const page = await orderPage(orderId)

      expect(await stillTestMode(orderId)).toBe(true)
      expect(queued).toMatchObject({ kind: "sale", provider: "parasut" })
      expect(issued).toMatchObject({ status: "issued", document_type: "e_archive" })
      expect(page.sale_hold).toBeNull()
      expect(page.invoices).toEqual([expect.objectContaining({ kind: "sale", status: "issued" })])
    })
  },
})
