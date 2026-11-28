import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow, createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeVkn, seededRandom, startFakeAras } from "@qticaret/testing"
import type { FakeAras } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { invoiceTotalsOf } from "../../src/workflows/einvoice/draft-source"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import { carrierOrder, carrierShop, shipOrder } from "../helpers/carrier"
import type { CarrierShop } from "../helpers/carrier"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

const MINUTE = 60 * 1000
const carrier = { title: "Örnek Kargo A.Ş.", tax_id: fakeVkn(seededRandom(61)) }

interface InvoiceRow {
  id: string
  kind: string
  for_exchange: boolean
  status: string
  document_type: string | null
  total: string
}

/**
 * F8 E6b (the accountant, 2026-10-31, docs/mali-musavir-sorulari.md 5.4):
 * a swap is two documents, a return for what came back and a sale of its
 * own for what went out; the order's first invoice stays as it was sold.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeAras
    let setup: CarrierShop
    let customer: TestCustomer
    let sizes: { M: string; XL: string }
    let clock = Date.now()

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    const invoices = () => getContainer().resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    const staff = <T>(path: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const listed = async (orderId: string) =>
      (
        await settle(
          http.get<{ invoices?: InvoiceRow[] }>(`/admin/invoices?order_id=${orderId}`, {
            headers: setup.admin.headers,
          })
        )
      ).data.invoices ?? []

    /** A shirt in M (120 TL) and XL (170 TL), ten of each. */
    const shirt = async () => {
      const handle = `gomlek-${String(Date.now())}-${String(Math.random()).slice(2, 6)}`
      const { result } = await createProductsWorkflow(getContainer()).run({
        input: {
          products: [
            {
              title: handle,
              handle,
              status: "published",
              shipping_profile_id: setup.shop.shippingProfileId,
              options: [{ title: "Beden", values: ["M", "XL"] }],
              variants: (["M", "XL"] as const).map((name) => ({
                title: name,
                options: { Beden: name },
                manage_inventory: true,
                weight: 450,
                length: 35,
                width: 8,
                height: 4,
                prices: [{ currency_code: "try", amount: name === "M" ? 120 : 170 }],
              })),
              sales_channels: [{ id: setup.shop.salesChannelId }],
            },
          ],
        },
      })
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["id", "title", "inventory_items.inventory_item_id"],
        filters: { id: (result[0]?.variants ?? []).map((variant) => variant.id) },
      })
      const rows = data as {
        id: string
        title: "M" | "XL"
        inventory_items: { inventory_item_id: string }[]
      }[]
      await createInventoryLevelsWorkflow(getContainer()).run({
        input: {
          inventory_levels: rows.map((row) => ({
            inventory_item_id: row.inventory_items[0]?.inventory_item_id ?? "",
            location_id: setup.shop.locationId,
            stocked_quantity: 10,
          })),
        },
      })
      return Object.fromEntries(rows.map((row) => [row.title, row.id])) as typeof sizes
    }

    /** Parcels moved on by the carrier's tracking, to delivered. */
    const track = async () => {
      for (let step = 0; step < 4; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
    }

    /** An M the customer bought, paid, received; its sale written back as an e-Arşiv when asked. */
    const delivered = async (writeBack: boolean) => {
      const orderId = await carrierOrder(getContainer(), setup, sizes.M)
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id })
      const { data } = await query().graph({
        entity: "order",
        fields: ["items.id", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        items: { id: string }[]
        payment_collections: { payments: { id: string }[] }[]
      }
      const paymentId = row.payment_collections[0]?.payments[0]?.id ?? ""
      const captured = await staff(`/admin/payments/${paymentId}/capture`)
      const shipped = await shipOrder(http, setup, orderId)
      expect([captured.status, shipped.status, shipped.data.message]).toEqual([200, 200, undefined])
      await track()
      const sale = await eventually(
        async () => (await listed(orderId)).find((invoice) => invoice.kind === "sale"),
        Boolean
      )
      if (writeBack) {
        const year = new Date(Date.now() + 3 * 3_600_000).getUTCFullYear()
        const written = await staff(`/admin/invoices/${sale?.id ?? ""}/issued`, {
          number: `WEB${String(year)}${String(Date.now()).slice(-9)}`,
          document_type: "e_archive",
          issued_at: new Date().toISOString(),
        })
        expect(written.status).toBe(200)
      }
      return { orderId, lineId: row.items[0]?.id ?? "", saleId: sale?.id ?? "" }
    }

    /** M swapped for XL (50 TL more, collected by staff), approved and received back. */
    const swapped = async (orderId: string, lineId: string) => {
      const asked = await settle(
        http.post<{ return_request: { id: string } }>(
          `/store/orders/${orderId}/returns`,
          {
            kind: "exchange",
            items: [{ line_item_id: lineId, quantity: 1, variant_id: sizes.XL }],
            reason: "size_issue",
          },
          { headers: customer.headers }
        )
      )
      const id = asked.data.return_request.id
      const approved = await staff(`/admin/return-requests/${id}/approve`, {
        difference_collected: true,
      })
      expect([asked.status, approved.status, approved.data.message]).toEqual([200, 200, undefined])
      const received = await staff(`/admin/return-requests/${id}/receive`, {
        items: [{ line_item_id: lineId, quantity: 1 }],
      })
      expect([received.status, received.data.message]).toEqual([200, undefined])
      return id
    }

    beforeAll(async () => {
      fake = await startFakeAras()
      process.env["ARAS_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["ARAS_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      setup = await carrierShop(http, getContainer(), fake)
      sizes = await shirt()
      customer = await registerCustomer(http, await createStorefront(getContainer()))
      await staff("/admin/platform-settings/seo", { canonical_host: "magaza.example.com" })
    })

    const invoicing = async (trigger: "placed" | "shipped") => {
      const saved = await staff("/admin/platform-settings/invoicing", {
        provider: "external",
        trigger,
        carriers: { aras: carrier, manual: carrier },
      })
      expect([saved.status, saved.data.message]).toEqual([200, undefined])
    }

    it("issues a return for the M and a sale of its own for the XL, the first sale as sold", async () => {
      await invoicing("placed")
      const { orderId, lineId, saleId } = await delivered(true)

      const requestId = await swapped(orderId, lineId)
      const records = await eventually(
        () => listed(orderId),
        (rows) => rows.length === 3
      )
      const exchangeSale = records.find((row) => row.for_exchange)
      const draft = await settle(
        http.get<{
          draft: {
            lines: { description: string; gross: string }[]
            totals: { gross: string }
            internet_sale: { paid_on: string }
            shipment: { carrier: { title: string } } | null
          }
        }>(`/admin/invoices/${exchangeSale?.id ?? ""}/draft`, { headers: setup.admin.headers })
      )
      const firstSale = await invoiceTotalsOf(getContainer(), orderId)
      const [returnRecord] = await invoices().listInvoices({ order_id: orderId, kind: "return" })

      // The return gives back the M (120 TL) on the e-Arşiv it was sold on
      expect(returnRecord).toMatchObject({
        source_id: requestId,
        document_type: "expense_voucher",
        original_invoice_id: saleId,
      })
      expect(Number(returnRecord?.gross_total)).toBe(120)
      // The XL is a sale of its own, at its price, with no shipping (the shop's)
      expect(exchangeSale).toMatchObject({ kind: "sale", status: "pending", total: "170" })
      expect(draft.status).toBe(200)
      expect(draft.data.draft.lines).toHaveLength(1)
      expect(draft.data.draft.lines[0]?.description).toMatch(/XL$/)
      expect(draft.data.draft.totals.gross).toBe("170.00")
      expect(draft.data.draft.shipment?.carrier.title).toBe(carrier.title)
      // The first sale still reads as sold: the M and its shipping, not the XL
      expect(firstSale?.totals.gross).toBe("180.00")
      expect(records.filter((row) => row.kind === "sale" && !row.for_exchange)).toHaveLength(1)
    })

    it("waits for the XL's parcel when the shop invoices on shipping, then the shopper reads both", async () => {
      await invoicing("shipped")
      const { orderId, lineId } = await delivered(true)

      await swapped(orderId, lineId)
      const before = await eventually(
        () => listed(orderId),
        (rows) => rows.some((row) => row.kind === "return")
      )
      const sent = await shipOrder(http, setup, orderId)
      await track()
      const after = await eventually(
        () => listed(orderId),
        (rows) => rows.some((row) => row.for_exchange)
      )
      const exchangeSale = after.find((row) => row.for_exchange)
      const year = new Date(Date.now() + 3 * 3_600_000).getUTCFullYear()
      await staff(`/admin/invoices/${exchangeSale?.id ?? ""}/issued`, {
        number: `WEB${String(year)}${String(Date.now() + 1).slice(-9)}`,
        document_type: "e_archive",
        issued_at: new Date().toISOString(),
      })
      const shopper = await settle(
        http.get<{
          invoice: { id: string } | null
          exchange_invoices: { id: string; has_pdf: boolean }[]
        }>(`/store/orders/${orderId}/invoice`, { headers: customer.headers })
      )
      const foreign = await settle(
        http.get(`/store/orders/${orderId}/invoice/pdf?invoice=inv_someoneelse`, {
          headers: customer.headers,
        })
      )

      expect(before.some((row) => row.for_exchange)).toBe(false)
      expect(sent.status).toBe(200)
      expect(exchangeSale).toMatchObject({ status: "pending", total: "170" })
      expect(shopper.status).toBe(200)
      expect(shopper.data.invoice).not.toBeNull()
      expect(shopper.data.exchange_invoices.map((row) => row.id)).toEqual([exchangeSale?.id])
      expect(foreign.status).toBe(404)
    })
  },
})
