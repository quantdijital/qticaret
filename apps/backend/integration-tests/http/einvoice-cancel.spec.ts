import { randomBytes } from "node:crypto"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeParasut } from "@qticaret/testing"
import type { FakeParasut } from "@qticaret/testing"
import { issueInvoices } from "../../src/jobs/einvoice-issue"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

const ENV = ["PARASUT_CLIENT_ID", "PARASUT_CLIENT_SECRET", "PARASUT_BASE_URL"] as const
const minutesLater = (minutes: number) => new Date(Date.now() + minutes * 60_000)

/** F8 E6 (adr/0034 §10): a canceled order's invoice undone at Paraşüt, or left for a return document. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const client = { clientId: "test-platform", clientSecret: randomBytes(16).toString("hex") }
    const user = { username: "test@example.com", password: randomBytes(16).toString("hex") }
    let parasut: FakeParasut
    let shop: StockShop
    let owner: { headers: Record<string, string> }
    let variantId: string

    const invoiceOf = async (orderId: string) =>
      (
        await getContainer()
          .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
          .listInvoices({ order_id: orderId })
      )[0]
    const paidOrder = async () => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        email: "ayse@example.com",
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
      await advanceOrder(getContainer(), orderId, "to_ship")
      await eventually(() => invoiceOf(orderId), Boolean)
      return orderId
    }
    const runUntil = async (orderId: string, done: (status: string | undefined) => boolean) => {
      for (let minute = 0; minute < 12; minute++) {
        await issueInvoices(getContainer(), minutesLater(minute * 2))
        const row = await invoiceOf(orderId)
        if (done(row?.status)) {
          return row
        }
      }
      return invoiceOf(orderId)
    }
    const cancel = async (orderId: string) => {
      await advanceOrder(getContainer(), orderId, "canceled")
      return eventually(
        () => invoiceOf(orderId),
        (row) => row?.cancel_requested_at !== null || row.status === "cancelled"
      )
    }

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
      variantId = (await stockedProduct(container, shop, `iptal-${String(Date.now())}`, 10, 120))
        .variantId
      await http.post(
        "/admin/einvoice/parasut",
        { company_id: parasut.companyId, code: parasut.issueCode() },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/invoicing",
        { provider: "parasut", trigger: "placed" },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: owner.headers }
      )
    })

    it("cancels an issued e-Arşiv within its days, and refuses to edit an invoiced order", async () => {
      const orderId = await paidOrder()
      const issued = await runUntil(orderId, (status) => status === "issued")
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const lineId = (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const edit = await settle(
        http.post<{ message?: string }>(
          `/admin/orders/${orderId}/edit/preview`,
          { items: [{ id: lineId, quantity: 2 }] },
          { headers: owner.headers }
        )
      )

      await cancel(orderId)
      const undone = await runUntil(orderId, (status) => status === "cancelled")
      const atParasut = [...parasut.invoices.values()].find(
        (invoice) => invoice.id === issued?.external_id
      )

      expect(issued).toMatchObject({ status: "issued", document_type: "e_archive" })
      expect(edit.data.message).toBe("orders.edit_invoiced")
      expect(undone).toMatchObject({ status: "cancelled", cancel_requested_at: null })
      expect(atParasut?.cancelled).toBe(true)
    })

    it("cancels an invoice never sent without a word to Paraşüt", async () => {
      const orderId = await paidOrder()
      const before = parasut.requests.length
      await cancel(orderId)
      const undone = await runUntil(orderId, (status) => status === "cancelled")

      expect(undone).toMatchObject({ status: "cancelled" })
      expect(parasut.requests.slice(before).filter((request) => request.method !== "GET")).toEqual(
        []
      )
    })

    it("sees an order canceled whose event was missed, before anything goes to Paraşüt", async () => {
      const orderId = await paidOrder()
      await advanceOrder(getContainer(), orderId, "canceled")
      const row = await eventually(
        () => invoiceOf(orderId),
        (found) => found?.cancel_requested_at !== null
      )
      // As if the event never came: the mark taken off again
      await getContainer()
        .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
        .updateInvoices({ id: row?.id ?? "", cancel_requested_at: null })
      const before = parasut.requests.length
      const undone = await runUntil(orderId, (status) => status === "cancelled")

      expect(undone).toMatchObject({ status: "cancelled" })
      expect(parasut.requests.slice(before).filter((request) => request.method !== "GET")).toEqual(
        []
      )
    })

    it("leaves an e-Arşiv past its days issued, and rings the bell for a return document", async () => {
      const orderId = await paidOrder()
      const issued = await runUntil(orderId, (status) => status === "issued")
      const document = [...parasut.documents.values()].find(
        (row) => row.invoice_id === issued?.external_id
      )
      if (document) {
        document.attributes["cancellable_until"] = new Date(Date.now() - 1000).toISOString()
      }

      await cancel(orderId)
      const kept = await runUntil(orderId, (status) => status === "issued")
      const settled = await eventually(
        () => invoiceOf(orderId),
        (row) => row?.cancel_requested_at === null
      )
      const bell = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed" })

      expect(kept?.status).toBe("issued")
      expect(settled).toMatchObject({ last_error: "einvoice.return_document_needed" })
      expect(bell.filter(({ data }) => data?.["kind"] === "einvoice_return_needed")).toHaveLength(1)
    })
  },
})
