import { readFileSync, rmSync } from "node:fs"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { clearDashboardCache } from "../../src/api/admin/dashboard/overview/read"
import { turkishDay } from "../../src/lib/dashboard"
import { CSV_BOM } from "../../src/lib/security"
import { fromMedusaAmount } from "../../src/lib/money"
import type { MedusaAmount } from "../../src/lib/money"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface Report {
  period: { key: string; granularity: string; from: string; to: string }
  totals: { sales: { current: string }; orders: { current: number } }
  top_products: { title: string; units: number; sales: string }[]
  series: { bucket: string }[]
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
    const today = () => turkishDay(new Date())

    const get = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))
    const order = async (variantId: string, quantity: number) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
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
      admin = await createAdminUser(http, container)
    })

    afterAll(() => {
      for (const path of filesNamed(/satis-raporu-.*\.(csv|xlsx)$/)) {
        rmSync(path, { force: true })
      }
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
      const file = filesNamed(/satis-raporu-.*\.csv$/).find((path) =>
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
      expect(csv).toMatch(/;1;"99,5";"[\d,]+";"99,5"/)
      expect(xlsx).toMatchObject({ status: "succeeded" })
    })
  },
})
