import { randomBytes } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom, startFakeParasut } from "@qticaret/testing"
import type { FakeParasut } from "@qticaret/testing"
import { issueInvoices } from "../../src/jobs/einvoice-issue"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { queueSaleInvoice } from "../../src/workflows/einvoice/queue-invoices"
import { orderAccessKey, orderAccessToken } from "../../src/lib/orders"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const ENV = ["PARASUT_CLIENT_ID", "PARASUT_CLIENT_SECRET", "PARASUT_BASE_URL"] as const
const minutesLater = (minutes: number) => new Date(Date.now() + minutes * 60_000)

/** F8 E3 (adr/0034 §7, §8; KK1 with the fake, KK2, KK3): an order's invoice issued at Paraşüt. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const client = { clientId: "test-platform", clientSecret: randomBytes(16).toString("hex") }
    const user = { username: "test@example.com", password: randomBytes(16).toString("hex") }
    const carrierVkn = fakeVkn(seededRandom(21))
    let parasut: FakeParasut
    let shop: StockShop
    let owner: { headers: Record<string, string> }
    let variantId: string

    const invoices = () => getContainer().resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    const invoiceOf = async (orderId: string) =>
      (await invoices().listInvoices({ order_id: orderId }))[0]
    const order = () =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 2 }],
        email: "ayse@example.com",
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
    const setUp = async (trigger: "shipped" | "placed") => {
      await http.post(
        "/admin/einvoice/parasut",
        { company_id: parasut.companyId, code: parasut.issueCode() },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/invoicing",
        {
          provider: "parasut",
          trigger,
          carriers: { manual: { title: "Örnek Kargo A.Ş.", tax_id: carrierVkn } },
        },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: owner.headers }
      )
    }
    /** The job, run as the minutes pass, until the invoice stops moving. */
    const runUntilSettled = async (orderId: string) => {
      for (let minute = 0; minute < 12; minute++) {
        await issueInvoices(getContainer(), minutesLater(minute * 2))
        const row = await invoiceOf(orderId)
        if (row && (row.status === "issued" || row.status === "failed")) {
          return row
        }
      }
      return invoiceOf(orderId)
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
      variantId = (await stockedProduct(container, shop, `fatura-${String(Date.now())}`, 10, 120))
        .variantId
    })

    it("issues an e-Arşiv when the parcel leaves, keeps its PDF, and never makes a second", async () => {
      await setUp("shipped")
      const orderId = await order()
      const notYet = await invoiceOf(orderId)
      await advanceOrder(getContainer(), orderId, "shipped")
      const queued = await eventually(() => invoiceOf(orderId), Boolean)
      const issued = await runUntilSettled(orderId)
      const again = await queueSaleInvoice(getContainer(), orderId, "shipped")
      const storefront = await createStorefront(getContainer())
      const shopper = {
        ...storefront.headers,
        "x-order-token": orderAccessToken(orderAccessKey(), {
          id: orderId,
          email: "ayse@example.com",
        }),
      }
      const forShopper = await http.get<{ invoice: { number: string; has_pdf: boolean } }>(
        `/store/orders/${orderId}/invoice`,
        { headers: shopper }
      )
      const shopperPdf = await fetch(
        `${(api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""}/store/orders/${orderId}/invoice/pdf`,
        { headers: shopper }
      )
      const stranger = await settle(
        http.get(`/store/orders/${orderId}/invoice`, { headers: storefront.headers })
      )
      // The test shop sends no e-mail: the message is tried and kept as skipped
      const told = await eventually(
        () =>
          getContainer()
            .resolve<MessagingModuleService>(MESSAGING_MODULE)
            .listMessageSkips({ template: "order.invoiced", resource_id: issued?.id ?? "" }),
        (rows) => rows.length > 0
      )
      const job = [...parasut.jobs.values()].at(-1)
      const pdf = await getContainer()
        .resolve(Modules.FILE)
        .getAsBuffer(issued?.pdf_file_id ?? "")

      expect(notYet).toBeUndefined()
      expect(queued).toMatchObject({ kind: "sale", provider: "parasut", status: "pending" })
      expect(issued).toMatchObject({ status: "issued", document_type: "e_archive" })
      expect(issued?.number).toMatch(/^SHT\d{13}$/)
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
      expect(job?.attributes).toMatchObject({
        internet_sale: { url: "https://magaza.example.com", payment_type: "ODEMEARACISI" },
        shipment: { title: "Örnek Kargo A.Ş.", vkn: carrierVkn },
      })
      expect(forShopper.data.invoice).toEqual({
        number: issued?.number,
        has_pdf: true,
        document_type: "e_archive",
        issued_at: expect.any(String) as unknown,
      })
      expect(
        Buffer.from(await shopperPdf.arrayBuffer())
          .subarray(0, 5)
          .toString()
      ).toBe("%PDF-")
      expect(stranger.status).toBeGreaterThanOrEqual(400)
      expect(told).toHaveLength(1)
      expect(again).toBe("already")
      expect(
        [...parasut.invoices.values()].filter((row) => row.attributes["order_no"])
      ).toHaveLength(1)
    })

    it("waits out Paraşüt being down, and stops for staff when an answer is lost (KK2)", async () => {
      await setUp("shipped")
      const down = await order()
      const lost = await order()
      // Down for one try: each read refused (the client asks three times itself)
      for (let n = 0; n < 3; n++) {
        parasut.queue("GET /contacts", {
          status: 503,
          body: { errors: [{ title: "Service Unavailable" }] },
        })
      }
      await advanceOrder(getContainer(), down, "shipped")
      await eventually(() => invoiceOf(down), Boolean)
      await issueInvoices(getContainer())
      const waiting = await invoiceOf(down)
      const recovered = await runUntilSettled(down)

      await advanceOrder(getContainer(), lost, "shipped")
      await eventually(() => invoiceOf(lost), Boolean)
      parasut.queue("POST /sales_invoices", { drop: true })
      await issueInvoices(getContainer())
      const stopped = await invoiceOf(lost)
      const retried = await http.post(
        `/admin/invoices/${stopped?.id ?? ""}/retry`,
        {},
        { headers: owner.headers }
      )
      const afterRetry = await runUntilSettled(lost)
      const bell = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ channel: "feed" })

      expect(waiting).toMatchObject({ status: "pending", attempts: 1 })
      expect(recovered).toMatchObject({ status: "issued" })
      expect(stopped).toMatchObject({ status: "failed", last_error: "einvoice.outcome_unknown" })
      expect(bell.filter(({ data }) => data?.["kind"] === "einvoice_stopped")).toHaveLength(1)
      expect(retried.status).toBe(200)
      expect(afterRetry).toMatchObject({ status: "issued" })
    })

    it("on the placed setting, waits for the payment to be taken", async () => {
      await setUp("placed")
      const orderId = await order()
      const placed = await invoiceOf(orderId)
      await advanceOrder(getContainer(), orderId, "to_ship")
      const paid = await eventually(() => invoiceOf(orderId), Boolean)

      expect(placed).toBeUndefined()
      expect(paid).toMatchObject({ status: "pending" })
    })
  },
})
