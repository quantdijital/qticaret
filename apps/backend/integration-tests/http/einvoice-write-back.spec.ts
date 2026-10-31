import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom } from "@qticaret/testing"
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

jest.setTimeout(180 * 1000)

interface Invoice {
  id: string
  order_id: string
  order_display_id: number | null
  status: string
  number: string | null
  has_pdf: boolean
}

const PDF = Buffer.from("%PDF-1.4\n% fatura\n%%EOF\n")
const carrier = { title: "Örnek Kargo A.Ş.", tax_id: fakeVkn(seededRandom(33)) }
// The day in Türkiye, as the e-Arşiv writes it
const turkishToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())

/** F8 E4 (adr/0034 §9): the shop's own program reads what waits and writes the invoice back. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let owner: { headers: Record<string, string>; plain: Record<string, string> }
    let variantId: string

    const basic = (token: string) => ({
      authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
    })
    const keyFor = async (scopes: string[]) =>
      (
        await http.post<{ token: string }>(
          "/admin/api-access",
          { title: "Fatura programı", scopes },
          { headers: owner.headers }
        )
      ).data.token
    const invoiceOf = async (orderId: string) =>
      (
        await getContainer()
          .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
          .listInvoices({ order_id: orderId })
      )[0]

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      owner = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `harici-${String(Date.now())}`, 10, 120))
        .variantId
      await http.post(
        "/admin/platform-settings/invoicing",
        // Web sales in their own series (the accountant, 2026-10-31)
        { provider: "external", trigger: "placed", carriers: { manual: carrier }, series: "ABC" },
        { headers: owner.headers }
      )
      await http.post(
        "/admin/platform-settings/seo",
        { canonical_host: "magaza.example.com" },
        { headers: owner.headers }
      )
    })

    it("lists what waits, gives its contents, and takes the number and the PDF back once", async () => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        email: "ayse@example.com",
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
      await advanceOrder(getContainer(), orderId, "to_ship")
      const queued = await eventually(() => invoiceOf(orderId), Boolean)
      const reader = await keyFor(["invoices:read"])
      const writer = await keyFor(["invoices:read", "invoices:write"])
      const operations = await createAdminUser(http, getContainer(), "operations")
      const id = queued?.id ?? ""
      const issued = {
        number: "ABC2026000000123",
        uuid: randomUUID(),
        document_type: "e_archive",
        issued_at: new Date().toISOString(),
      }

      const waiting = await http.get<{ invoices: Invoice[] }>(
        "/admin/invoices?status=pending&provider=external",
        { headers: basic(reader) }
      )
      const draft = await http.get<{
        draft: {
          buyer: { name: string }
          totals: { gross: string }
          shipment: { carrier: typeof carrier; shipped_on: string } | null
        }
        series: string | null
      }>(`/admin/invoices/${id}/draft`, { headers: basic(reader) })
      const readerWrites = await settle(
        http.post(`/admin/invoices/${id}/issued`, issued, { headers: basic(reader) })
      )
      const byOperations = await settle(
        http.post(`/admin/invoices/${id}/issued`, issued, { headers: operations.headers })
      )
      const pdfFirst = await settle(
        http.post(`/admin/invoices/${id}/pdf`, PDF, {
          headers: { ...basic(writer), "content-type": "application/pdf" },
        })
      )
      const otherSeries = await settle(
        http.post(
          `/admin/invoices/${id}/issued`,
          { ...issued, number: "XYZ2026000000123" },
          { headers: basic(writer) }
        )
      )
      const written = await http.post<{ changed: boolean }>(
        `/admin/invoices/${id}/issued`,
        issued,
        {
          headers: basic(writer),
        }
      )
      const again = await http.post<{ changed: boolean }>(`/admin/invoices/${id}/issued`, issued, {
        headers: basic(writer),
      })
      const another = await settle(
        http.post(
          `/admin/invoices/${id}/issued`,
          { ...issued, number: "ABC2026000000124" },
          { headers: basic(writer) }
        )
      )
      const notPdf = await settle(
        http.post(`/admin/invoices/${id}/pdf`, Buffer.from("<html>"), {
          headers: { ...basic(writer), "content-type": "application/pdf" },
        })
      )
      const pdf = await settle(
        http.post(`/admin/invoices/${id}/pdf`, PDF, {
          headers: { ...basic(writer), "content-type": "application/pdf" },
        })
      )
      const draftAfter = await settle(
        http.get(`/admin/invoices/${id}/draft`, { headers: basic(reader) })
      )
      const staffWithoutProof = await settle(
        http.get(`/admin/invoices/${id}/draft`, { headers: owner.plain })
      )
      const row = await invoiceOf(orderId)
      const stored = await getContainer()
        .resolve(Modules.FILE)
        .getAsBuffer(row?.pdf_file_id ?? "")

      expect(waiting.data.invoices.map((invoice) => invoice.order_id)).toContain(orderId)
      expect(
        waiting.data.invoices.find((invoice) => invoice.order_id === orderId)?.order_display_id
      ).toEqual(expect.any(Number))
      expect(draft.data.draft.buyer.name).toBe("Ayşe Yılmaz")
      expect(draft.data.draft.totals.gross).toBe(Number(queued?.gross_total).toFixed(2))
      // Not shipped yet: the carrier the buyer chose, on the day the invoice is made
      expect(draft.data.draft.shipment).toEqual({ carrier, shipped_on: turkishToday() })
      expect(draft.data.series).toBe("ABC")
      expect(otherSeries.status).toBe(400)
      expect(otherSeries.data).toMatchObject({ message: "einvoice.series_mismatch" })
      expect(readerWrites.status).toBe(403)
      expect(byOperations.status).toBe(403)
      expect(pdfFirst.status).toBe(409)
      expect(written.data.changed).toBe(true)
      expect(again.data.changed).toBe(false)
      expect(another.status).toBe(409)
      expect(notPdf.status).toBe(400)
      expect(pdf.status).toBe(200)
      expect(row).toMatchObject({ status: "issued", number: "ABC2026000000123" })
      expect(stored.subarray(0, 5).toString()).toBe("%PDF-")
      // Once issued its buyer is not read through the program's door; staff prove themselves
      expect(draftAfter.status).toBe(409)
      expect(staffWithoutProof.status).toBe(428)
    })
  },
})
