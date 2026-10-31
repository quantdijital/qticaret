import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom } from "@qticaret/testing"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { queueReturnDocument } from "../../src/workflows/einvoice/queue-return"
import { RETURN_REFUNDED } from "../../src/workflows/returns/receive-return"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

const carrier = { title: "Örnek Kargo A.Ş.", tax_id: fakeVkn(seededRandom(55)) }
const lines = (lineId: string) =>
  [{ line_item_id: lineId, quantity: 1 }] as unknown as Record<string, unknown>

/**
 * F8 E6 (adr/0034 addendum, the accountant 2026-10-31): a person's return
 * gets the shop's gider pusulası for the goods and quantities that came
 * back, naming the e-Arşiv; staff enter it, or record why none is needed.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let owner: { headers: Record<string, string> }
    let variantId: string

    const invoices = () => getContainer().resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    const invoiceOf = async (orderId: string, kind: "sale" | "return") =>
      (await invoices().listInvoices({ order_id: orderId, kind }, { take: 1 }))[0]

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      owner = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `iade-${String(Date.now())}`, 10, 120))
        .variantId
      await http.post(
        "/admin/platform-settings/invoicing",
        { provider: "external", trigger: "placed", carriers: { manual: carrier } },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: owner.headers }
      )
    })

    /**
     * An order of two, invoiced by hand (an e-Arşiv unless said); one of the
     * two came back and was refunded, before the sale was entered if asked.
     */
    async function refundedReturn(
      options: { document?: "e_archive" | "e_invoice"; refundFirst?: boolean } = {}
    ) {
      const container = getContainer()
      const orderId = await placeOrder(container, {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 2 }],
        email: "ayse@example.com",
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
      await advanceOrder(container, orderId, "to_ship")
      const sale = await eventually(() => invoiceOf(orderId, "sale"), Boolean)
      const year = new Date(Date.now() + 3 * 3_600_000).getUTCFullYear()
      const saleNumber = `WEB${String(year)}000000077`
      const writeBack = async () => {
        const written = await http.post(
          `/admin/invoices/${sale?.id ?? ""}/issued`,
          {
            number: saleNumber,
            document_type: options.document ?? "e_archive",
            issued_at: new Date().toISOString(),
          },
          { headers: owner.headers }
        )
        expect(written.status).toBe(200)
      }
      if (!options.refundFirst) {
        await writeBack()
      }
      const { data } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const lineId = (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const request = await container
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .createReturnRequests({
          order_id: orderId,
          kind: "return",
          status: "refunded",
          reason: "damaged",
          // The module keeps lines as JSON, typed as a record (as request-return.ts writes them)
          items: lines(lineId),
          received_items: lines(lineId),
          refund_shipping: false,
        })
      return { orderId, requestId: request.id, saleId: sale?.id ?? "", year, saleNumber, writeBack }
    }

    it("queues a gider pusulası for what came back, shows its draft and takes its number", async () => {
      const { orderId, requestId, saleId, year } = await refundedReturn()
      const sale = await invoiceOf(orderId, "sale")

      const queued = await queueReturnDocument(getContainer(), requestId)
      const again = await queueReturnDocument(getContainer(), requestId)
      const record = await invoiceOf(orderId, "return")
      const draft = await http.get<{
        draft: {
          lines: { quantity: number; gross: string }[]
          return_of: { document: string; number: string; issued_on: string }
          shipment: unknown
        }
      }>(`/admin/invoices/${record?.id ?? ""}/draft`, { headers: owner.headers })
      const asSale = await settle(
        http.post(
          `/admin/invoices/${record?.id ?? ""}/issued`,
          {
            number: `WEB${String(year)}000000078`,
            document_type: "e_archive",
            issued_at: new Date().toISOString(),
          },
          { headers: owner.headers }
        )
      )
      const operations = await createAdminUser(http, getContainer(), "operations")
      const byOperations = await settle(
        http.post(
          `/admin/invoices/${record?.id ?? ""}/return-document`,
          { number: "GP 000123", issued_at: new Date().toISOString() },
          { headers: operations.headers }
        )
      )
      const entered = await http.post<{ changed: boolean }>(
        `/admin/invoices/${record?.id ?? ""}/return-document`,
        { number: "gp 000123", issued_at: new Date().toISOString() },
        { headers: owner.headers }
      )
      const enteredAgain = await http.post<{ changed: boolean }>(
        `/admin/invoices/${record?.id ?? ""}/return-document`,
        { number: "GP 000123", issued_at: new Date().toISOString() },
        { headers: owner.headers }
      )
      const waivedAfter = await settle(
        http.post(
          `/admin/invoices/${record?.id ?? ""}/waive`,
          { reason: "payment_institution" },
          { headers: owner.headers }
        )
      )
      const done = await invoiceOf(orderId, "return")

      expect([queued, again]).toEqual(["queued", "already"])
      expect(record).toMatchObject({
        kind: "return",
        provider: "external",
        status: "pending",
        document_type: "expense_voucher",
        original_invoice_id: saleId,
      })
      // One of the two sold at 120, KDV included; the shipping on the sale stays
      expect(Number(record?.gross_total)).toBe(120)
      expect(Number(sale?.gross_total)).toBeGreaterThan(240)
      expect(draft.data.draft.lines).toEqual([expect.objectContaining({ quantity: 1 })])
      expect(draft.data.draft.return_of).toMatchObject({
        document: "expense_voucher",
        number: `WEB${String(year)}000000077`,
      })
      expect(draft.data.draft.return_of.issued_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(draft.data.draft.shipment).toBeNull()
      expect(asSale.status).toBe(409)
      expect(asSale.data).toMatchObject({ message: "einvoice.not_sale" })
      expect(byOperations.status).toBe(403)
      expect([entered.data.changed, enteredAgain.data.changed]).toEqual([true, false])
      expect(done).toMatchObject({ status: "issued", number: "GP 000123" })
      expect(waivedAfter.status).toBe(409)
    })

    it("queues one on the refund's event, records why none is needed, and leaves an order with no invoice alone", async () => {
      const { orderId, requestId } = await refundedReturn()
      // As refundReturn tells it (workflows/returns/receive-return.ts)
      await getContainer()
        .resolve(Modules.EVENT_BUS)
        .emit({ name: RETURN_REFUNDED, data: { id: requestId, order_id: orderId } })
      const record = await eventually(() => invoiceOf(orderId, "return"), Boolean)

      const unknownReason = await settle(
        http.post(
          `/admin/invoices/${record?.id ?? ""}/waive`,
          { reason: "forgot" },
          { headers: owner.headers }
        )
      )
      const waived = await http.post<{ changed: boolean }>(
        `/admin/invoices/${record?.id ?? ""}/waive`,
        { reason: "payment_institution" },
        { headers: owner.headers }
      )
      const after = await invoiceOf(orderId, "return")
      // A return of an order no invoice was issued for has no document to make
      const request = await getContainer()
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .createReturnRequests({
          order_id: "order_without_invoice",
          kind: "return",
          status: "refunded",
          reason: "damaged",
          items: lines("ordli_none"),
          refund_shipping: false,
        })

      expect(unknownReason.status).toBe(400)
      expect(waived.data.changed).toBe(true)
      expect(after).toMatchObject({ status: "waived", waived_reason: "payment_institution" })
      expect(await queueReturnDocument(getContainer(), request.id)).toBe("not_due")
    })

    it("keeps a program's key to sale invoices: no list, record, draft or PDF of a return's", async () => {
      const { orderId, requestId } = await refundedReturn()
      await queueReturnDocument(getContainer(), requestId)
      const record = await invoiceOf(orderId, "return")
      const key = (
        await http.post<{ token: string }>(
          "/admin/api-access",
          { title: "Fatura programı", scopes: ["invoices:read", "invoices:write"] },
          { headers: owner.headers }
        )
      ).data.token
      const program = { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` }

      const listed = await http.get<{ invoices: { kind: string }[] }>("/admin/invoices", {
        headers: program,
      })
      const one = await settle(
        http.get(`/admin/invoices/${record?.id ?? ""}`, { headers: program })
      )
      const draft = await settle(
        http.get(`/admin/invoices/${record?.id ?? ""}/draft`, { headers: program })
      )
      const pdf = await settle(
        http.post(`/admin/invoices/${record?.id ?? ""}/pdf`, Buffer.from("%PDF-1.4\n%%EOF\n"), {
          headers: { ...program, "content-type": "application/pdf" },
        })
      )

      expect(listed.data.invoices.map((row) => row.kind)).toEqual(["sale"])
      expect(one.status).toBe(404)
      expect([draft.status, pdf.status]).toEqual([409, 409])
      expect(draft.data).toMatchObject({ message: "einvoice.not_sale" })
    })

    it("asks a company's return invoice, never waived, its number free of the shop's", async () => {
      const { orderId, requestId, saleNumber } = await refundedReturn({ document: "e_invoice" })
      await queueReturnDocument(getContainer(), requestId)
      const record = await invoiceOf(orderId, "return")

      const waived = await settle(
        http.post(
          `/admin/invoices/${record?.id ?? ""}/waive`,
          { reason: "payment_institution" },
          { headers: owner.headers }
        )
      )
      // The company numbers in its own series: one may match a number of the shop's
      const entered = await http.post<{ changed: boolean }>(
        `/admin/invoices/${record?.id ?? ""}/return-document`,
        { number: saleNumber, issued_at: new Date().toISOString() },
        { headers: owner.headers }
      )

      expect(record?.document_type).toBe("return_invoice")
      expect(waived.status).toBe(409)
      expect(waived.data).toMatchObject({ message: "einvoice.waive_not_allowed" })
      expect(entered.data.changed).toBe(true)
    })

    it("queues a return's document once a sale entered after its refund is issued", async () => {
      const { orderId, requestId, writeBack } = await refundedReturn({ refundFirst: true })

      const before = await queueReturnDocument(getContainer(), requestId)
      await writeBack()
      const after = await eventually(() => invoiceOf(orderId, "return"), Boolean)

      expect(before).toBe("not_due")
      expect(after).toMatchObject({ kind: "return", document_type: "expense_voucher" })
    })
  },
})
