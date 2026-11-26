import { readFileSync } from "node:fs"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CSV_BOM } from "../../src/lib/security"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"

jest.setTimeout(240 * 1000)

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

interface Report {
  new_customers: { current: number; registered: number; guest: number }
  buyers: number
  returning: number
  top: { customer_id: string; name: string | null; orders: number; spent: string }[]
}

const ADDRESS = { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" }

/** CU2 and R1: the customer list as the owner's file, and the customers report. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }

    const get = <T>(url: string, headers = owner.headers) => settle(http.get<T>(url, { headers }))
    const post = <T>(url: string, body: unknown, headers = owner.headers) =>
      settle(http.post<T>(url, body, { headers }))

    const settled = async (id: string): Promise<Job> => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: owner.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }

    // Two guests who ordered (Ayşe twice), and one customer added in the panel
    async function customers() {
      const shop = await stockShop(getContainer())
      const { variantId } = await stockedProduct(getContainer(), shop, "musteri-kupa", 50)
      const order = (email: string) =>
        placeOrder(getContainer(), {
          ...shop,
          items: [{ variant_id: variantId, quantity: 1 }],
          email,
          address: ADDRESS,
        })
      await order("ayse@example.com")
      await order("ayse@example.com")
      await order("mehmet@example.com")
      await post("/admin/customers", { email: "zeynep@example.com", first_name: "Zeynep" })
    }

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
    })

    it("exports the filtered list for the owner alone, with the list's columns, and records it", async () => {
      await customers()
      const admin = await createAdminUser(http, getContainer(), "admin")

      const byAdmin = await post("/admin/customer-export", {}, admin.headers)
      const throughJobs = await post("/admin/async-jobs", { type: "customer.export", input: {} })
      const badKind = await post("/admin/customer-export", { kind: "vip" })
      const queued = await post<{ async_job: Job }>("/admin/customer-export", {
        q: "ayse",
        format: "csv",
      })
      const job = await settled(queued.data.async_job.id)
      const seenByAdmin = await get(`/admin/async-jobs/${job.id}`, admin.headers)
      const result = await get<{ url: string }>(`/admin/async-jobs/${job.id}/result`)
      const path = filesNamed(/musteriler-.*\.csv$/).find((file) =>
        result.data.url.endsWith(file.split("/").pop() ?? "")
      )
      const text = readFileSync(path ?? "", "utf8")
      const audit = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "customer.export_made" })

      expect(byAdmin.status).toBe(403)
      expect(throughJobs.status).toBe(400)
      expect(badKind.status).toBe(400)
      expect(queued.status).toBe(202)
      expect(job).toMatchObject({ status: "succeeded" })
      expect(job.result_summary).toMatchObject({ customers: 1, format: "csv", capped: false })
      expect(seenByAdmin.status).toBe(404)
      const [header, row, ...rest] = text.slice(CSV_BOM.length).trim().split(/\r?\n/)
      expect(header).toBe(
        "Ad Soyad;Firma;E-posta;Tür;Kayıt tarihi;Sipariş sayısı;Toplam harcama (₺);Ortalama sepet (₺);Son sipariş;Şehir"
      )
      expect(row).toContain("ayse@example.com;Misafir;")
      expect(row).toContain(";2;")
      expect(rest).toEqual([])
      // Nothing the list does not show: no phone, no address line
      expect(text).not.toContain("Demo Sokak")
      expect(audit).toEqual([
        expect.objectContaining({
          kind: "sensitive_read",
          changes: expect.objectContaining({ customers: 1, format: "csv" }) as unknown,
        }),
      ])

      // The guests' tab, every guest: Ayşe and Mehmet who ordered, Zeynep added by hand
      const guests = await post<{ async_job: Job }>("/admin/customer-export", { kind: "guest" })
      expect((await settled(guests.data.async_job.id)).result_summary).toMatchObject({
        customers: 3,
        format: "xlsx",
      })
    })

    it("reports new customers, returning buyers and the top spenders", async () => {
      await customers()
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const report = await get<Report>("/admin/reports/customers?period=7d", readonly.headers)
      const bad = await get("/admin/reports/customers?period=7d&from=2026-11-01")

      expect(report.status).toBe(200)
      expect(bad.status).toBe(400)
      expect(report.data.new_customers).toMatchObject({ current: 3, guest: 3 })
      expect(report.data.buyers).toBe(2)
      expect(report.data.returning).toBe(0)
      // Guests have no name of their own: the list shows their e-mail, so does the report
      expect(report.data.top.map((row) => [row.name, row.orders])).toEqual([
        ["ayse@example.com", 2],
        ["mehmet@example.com", 1],
      ])
    })
  },
})
