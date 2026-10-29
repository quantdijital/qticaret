import { readFileSync, rmSync } from "node:fs"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { clearDashboardCache } from "../../src/api/admin/dashboard/overview/read"
import { clearStockCache } from "../../src/api/admin/reports/stock/read"
import { turkishDay } from "../../src/lib/dashboard"
import { CSV_BOM } from "../../src/lib/security"
import { fromMedusaAmount } from "../../src/lib/money"
import type { MedusaAmount } from "../../src/lib/money"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { CHARGEBACKS_MODULE } from "../../src/modules/chargebacks"
import type ChargebacksModuleService from "../../src/modules/chargebacks/service"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface Report {
  period: { key: string; granularity: string; from: string; to: string }
  totals: { sales: { current: string }; orders: { current: number } }
  top_products: { title: string; units: number; sales: string }[]
  series: { bucket: string }[]
  details: {
    sources: { source: string; orders: number; sales: string }[]
    returns: { orders: number; returned: number; exchanged: number; return_rate: number }
    brands: { name: string | null }[]
    promotions: unknown[]
  }
}

interface FinanceReport {
  vat: { rate: number; base: string; tax: string; gross: string }[]
  payments: { method: string; captured: string; refunded: string }[]
  chargebacks: { order_display_id: number | null; amount: string; reason: string }[]
}

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

/** F11.1 (adr/0039; KK1, KK5): reports over any range of Turkish days, and their files. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let admin: { headers: Record<string, string> }
    let storefront: Storefront
    const today = () => turkishDay(new Date())

    const get = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))
    const order = async (
      variantId: string,
      quantity: number,
      beforeComplete?: (cartId: string) => Promise<void>
    ) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
        beforeComplete,
      })
    /** The storefront telling where the cart's shopper first landed from. */
    const landed = (cartId: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ recorded: boolean }>(`/store/carts/${cartId}/source`, body, {
          headers: storefront.headers,
        })
      )
    /** What the orders of the day say they total, read apart from the report (KK1). */
    const salesOfToday = async () => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["id", "status", "total", "currency_code"],
          filters: { is_draft_order: false },
        })
      return (data as { status: string; total: MedusaAmount; currency_code: string }[])
        .filter((row) => row.status !== "canceled" && row.currency_code === "try")
        .reduce((sum, row) => sum + fromMedusaAmount(row.total, { allowRounding: true }), 0)
    }
    const settled = async (id: string): Promise<Job> => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: admin.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      clearDashboardCache()
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
    })

    afterAll(() => {
      for (const path of filesNamed(/(satis|finans|stok)-raporu-.*\.(csv|xlsx)$/)) {
        rmSync(path, { force: true })
      }
    })

    it("values stock at its unit cost, counts what has none apart, and turns it over", async () => {
      clearStockCache()
      const stamp = String(Date.now())
      const costed = await stockedProduct(getContainer(), shop, `stok-${stamp}`, 10, 200)
      await stockedProduct(getContainer(), shop, `maliyetsiz-${stamp}`, 4, 80)
      const saved = await settle(
        http.post(
          `/admin/products/${costed.productId}/catalog`,
          { variants: { [costed.variantId]: { cost: 75.5 } } },
          { headers: admin.headers }
        )
      )
      await advanceOrder(getContainer(), await order(costed.variantId, 3), "delivered")
      await advanceOrder(getContainer(), await order(costed.variantId, 2), "canceled")

      const report = await get<{
        totals: Record<string, unknown>
        value: Record<string, unknown>[]
        uncosted: Record<string, unknown>[]
        idle: unknown[]
      }>("/admin/reports/stock?period=today")
      const row = report.data.value.find((entry) => entry["product_title"] === `stok-${stamp}`)
      const file = await settled(
        (
          await http.post<{ async_job: Job }>(
            "/admin/async-jobs",
            { type: "report.export", input: { report: "stock", format: "csv", table: "idle" } },
            { headers: admin.headers }
          )
        ).data.async_job.id
      )
      const book = await settled(
        (
          await http.post<{ async_job: Job }>(
            "/admin/async-jobs",
            { type: "report.export", input: { report: "stock", period: "today" } },
            { headers: admin.headers }
          )
        ).data.async_job.id
      )
      const foreign = await settle(
        http.post(
          "/admin/async-jobs",
          { type: "report.export", input: { report: "stock", format: "csv", table: "vat" } },
          { headers: admin.headers }
        )
      )

      expect(saved.status).toBe(200)
      expect(row).toMatchObject({
        sku: null,
        on_hand: 7,
        cost: "75.50",
        value: "528.50",
        // The canceled order sold nothing
        sold: 3,
        idle: false,
      })
      expect(row?.["turnover"]).toEqual(expect.any(Number))
      expect(report.data.uncosted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ product_title: `maliyetsiz-${stamp}`, on_hand: 4, cost: null }),
        ])
      )
      expect(report.data.totals).toMatchObject({ value: "528.50", costed_items: 1 })
      // Made today: not idle, whatever it sold
      expect(report.data.idle).toEqual([])
      expect(file).toMatchObject({ status: "succeeded" })
      expect(filesNamed(/stok-raporu-hareketsiz-stok-.*\.csv$/)).not.toHaveLength(0)
      expect(book.result_summary).toMatchObject({ report: "stock", format: "xlsx", capped: false })
      expect(foreign.status).toBe(400)
    })

    it("totals a range of days as the orders themselves do, canceled ones left out", async () => {
      const { variantId } = await stockedProduct(
        getContainer(),
        shop,
        `rapor-${String(Date.now())}`,
        20,
        149.9
      )
      await advanceOrder(getContainer(), await order(variantId, 2), "delivered")
      await order(variantId, 1)
      await advanceOrder(getContainer(), await order(variantId, 3), "canceled")
      const expected = await salesOfToday()

      const report = await get<Report>(`/admin/reports/sales?from=${today()}&to=${today()}`)

      expect(report.status).toBe(200)
      expect(report.data.period).toMatchObject({ key: "range", granularity: "hour" })
      expect(report.data.totals.orders.current).toBe(2)
      // KK1: to the kuruş
      expect(fromMedusaAmount(report.data.totals.sales.current as MedusaAmount)).toBe(expected)
      expect(report.data.top_products[0]?.units).toBe(3)
    })

    it("tells sales by where the shopper first landed from, and the orders that came back", async () => {
      const { variantId } = await stockedProduct(
        getContainer(),
        shop,
        `kaynak-${String(Date.now())}`,
        20,
        120
      )
      const answers: boolean[] = []
      const searched = await order(variantId, 1, async (cartId) => {
        for (const body of [
          { referrer: "https://www.google.com.tr/search?q=kupa" },
          // A later landing of the same cart changes nothing
          { utm_source: "bulten", utm_medium: "email" },
        ]) {
          answers.push((await landed(cartId, body)).data.recorded)
        }
      })
      await order(variantId, 2, async (cartId) => {
        await landed(cartId, { utm_source: "google", utm_medium: "cpc", gclid: true })
      })
      await order(variantId, 1)
      await getContainer()
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .createReturnRequests({
          order_id: searched,
          kind: "return",
          status: "requested",
          reason: "damaged",
          items: {},
        })
      const bad = await landed("cart_01UNKNOWN0000000000000000", { utm_source: "x" })

      const report = await get<Report>(`/admin/reports/sales?from=${today()}&to=${today()}`)
      const bySource = Object.fromEntries(
        report.data.details.sources.map((row) => [row.source, row.orders])
      )

      expect(answers).toEqual([true, false])
      expect(bad.status).toBe(404)
      expect(bySource).toMatchObject({ organic_search: 1, paid_search: 1, unknown: 1, email: 0 })
      expect(report.data.details.returns).toMatchObject({ orders: 3, returned: 1, exchanged: 0 })
      expect(report.data.details.brands).toEqual([expect.objectContaining({ name: null })])
    })

    it("splits a period's sales by VAT rate and its money by payment method, with its disputes", async () => {
      const { variantId } = await stockedProduct(
        getContainer(),
        shop,
        `finans-${String(Date.now())}`,
        20,
        240
      )
      const paid = await order(variantId, 2)
      await order(variantId, 1)
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["display_id", "total", "payment_collections.payments.id"],
          filters: { id: paid },
        })
      const row = data[0] as unknown as {
        display_id: number
        total: MedusaAmount
        payment_collections: { payments: { id: string }[] }[]
      }
      const paymentId = row.payment_collections[0]?.payments[0]?.id ?? ""
      await http.post(`/admin/payments/${paymentId}/capture`, {}, { headers: admin.headers })
      await getContainer().resolve<ChargebacksModuleService>(CHARGEBACKS_MODULE).createChargebacks({
        order_id: paid,
        payment_id: paymentId,
        provider: "pp_system_default",
        amount: 1_000,
        currency_code: "try",
        reason: "not_received",
      })
      const expected = await salesOfToday()

      const report = await get<FinanceReport>(
        `/admin/reports/finance?from=${today()}&to=${today()}`
      )
      const gross = report.data.vat.reduce(
        (sum, rate) => sum + fromMedusaAmount(rate.gross as MedusaAmount),
        0
      )
      const system = report.data.payments.find((method) => method.method === "system")
      const file = await settled(
        (
          await http.post<{ async_job: Job }>(
            "/admin/async-jobs",
            { type: "report.export", input: { report: "finance", period: "today" } },
            { headers: admin.headers }
          )
        ).data.async_job.id
      )
      const wrongTable = await settle(
        http.post(
          "/admin/async-jobs",
          { type: "report.export", input: { report: "finance", format: "csv", table: "daily" } },
          { headers: admin.headers }
        )
      )

      // KK1: the rates add up to what the orders total, to the kuruş
      expect(gross).toBe(expected)
      expect(report.data.vat.every((rate) => typeof rate.rate === "number")).toBe(true)
      expect(fromMedusaAmount(system?.captured as MedusaAmount)).toBe(
        fromMedusaAmount(row.total, { allowRounding: true })
      )
      expect(report.data.chargebacks).toEqual([
        expect.objectContaining({
          order_display_id: row.display_id,
          amount: "10.00",
          reason: "not_received",
        }),
      ])
      expect(file).toMatchObject({ status: "succeeded" })
      expect(wrongTable.status).toBe(400)
    })

    it("refuses a range that is no range, and anyone but staff", async () => {
      const lone = await get(`/admin/reports/sales?from=${today()}`)
      const both = await get(`/admin/reports/sales?period=7d&from=${today()}&to=${today()}`)
      const long = await get("/admin/reports/sales?from=2024-01-01&to=2025-06-30")
      const future = await get("/admin/reports/sales?from=2099-01-01&to=2099-01-02")
      const notADay = await get("/admin/reports/sales?from=2026-02-30&to=2026-03-01")
      const anonymous = await settle(http.get(`/admin/reports/sales?from=${today()}&to=${today()}`))

      expect([lone.status, both.status, long.status, future.status, notADay.status]).toEqual([
        400, 400, 400, 400, 400,
      ])
      expect(anonymous.status).toBe(401)
    })

    it("exports the report as the panel shows it, no cell starting a formula (KK5)", async () => {
      const { productId, variantId } = await stockedProduct(
        getContainer(),
        shop,
        `formul-${String(Date.now())}`,
        10,
        99.5
      )
      await getContainer()
        .resolve(Modules.PRODUCT)
        .updateProducts(productId, { title: '=HYPERLINK("https://kotu.example")' })
      await order(variantId, 1)

      const queued = await http.post<{ async_job: Job }>(
        "/admin/async-jobs",
        {
          type: "report.export",
          input: { from: today(), to: today(), format: "csv", table: "products" },
        },
        { headers: admin.headers }
      )
      const job = await settled(queued.data.async_job.id)
      const result = await http.get<{ url: string }>(`/admin/async-jobs/${job.id}/result`, {
        headers: admin.headers,
      })
      // A CSV's name says which table it is
      const file = filesNamed(/satis-raporu-urunler-.*\.csv$/).find((path) =>
        result.data.url.endsWith(path.split("/").pop() ?? "")
      )
      const csv = readFileSync(file ?? "", "utf8")
      const xlsx = await settled(
        (
          await http.post<{ async_job: Job }>(
            "/admin/async-jobs",
            { type: "report.export", input: { period: "today", format: "xlsx" } },
            { headers: admin.headers }
          )
        ).data.async_job.id
      )

      expect(job).toMatchObject({ status: "succeeded" })
      expect(job.result_summary).toMatchObject({ format: "csv", orders: 1, capped: false })
      expect(csv.startsWith(`${CSV_BOM}Sıra;Ürün;Adet;Ortalama fiyat (TL);Pay (%);Ciro (TL)`)).toBe(
        true
      )
      expect(csv).toContain(`'=HYPERLINK`)
      expect(csv).not.toMatch(/(^|;)=HYPERLINK/m)
      // A decimal comma, as Turkish Excel reads numbers
      // Its share is of the orders' total, shipping included, as the panel counts it
      expect(csv).toMatch(/;1;99,5;[\d,]+;99,5/)
      expect(xlsx).toMatchObject({ status: "succeeded" })
    })
  },
})
