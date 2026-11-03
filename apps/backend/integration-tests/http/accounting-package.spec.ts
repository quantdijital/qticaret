import { readFileSync, rmSync } from "node:fs"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { turkishDay } from "../../src/lib/dashboard"
import { readZipSafely } from "../../src/lib/security"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { upsertCustomerBillingProfileWorkflow } from "../../src/workflows/billing-profile/upsert-customer-billing-profile"
import { createAdminUser } from "../helpers/admin"
import { CORPORATE, VKN, billingProfileService } from "../helpers/billing-profile"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

/** F11.5 (adr/0039 §5): the month's standard package for the accountant. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let admin: { headers: Record<string, string> }
    const month = () => turkishDay(new Date()).slice(0, 7)

    const order = (variantId: string, email: string) =>
      placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        email,
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })
    const customerOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["customer_id", "display_id"], filters: { id: orderId } })
      return data[0] as unknown as { customer_id: string; display_id: number }
    }
    const queue = (input: Record<string, unknown>) =>
      settle(
        http.post<{ async_job: Job }>(
          "/admin/async-jobs",
          { type: "accounting.package", input },
          { headers: admin.headers }
        )
      )
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
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
    })

    afterAll(() => {
      for (const path of filesNamed(/muhasebe-paketi-.*\.zip$/)) {
        rmSync(path, { force: true })
      }
    })

    it("packs the month's sales with a corporate customer's VKN only, and records the read", async () => {
      const { variantId } = await stockedProduct(getContainer(), shop, "muhasebe-kupa", 10, 120)
      const corporate = await order(variantId, "satinalma@ornek-ticaret.example.com")
      await order(variantId, "ayse.yilmaz@example.com")
      const canceled = await order(variantId, "iptal@example.com")
      await advanceOrder(getContainer(), corporate, "delivered")
      await advanceOrder(getContainer(), canceled, "canceled")
      const buyer = await customerOf(corporate)
      await upsertCustomerBillingProfileWorkflow(getContainer()).run({
        input: {
          customer_id: buyer.customer_id,
          data: billingProfileService(getContainer()).prepareProfileData(
            CORPORATE as never,
            buyer.customer_id
          ),
        },
      })

      const queued = await queue({ month: month() })
      const job = await settled(queued.data.async_job.id)
      const result = await http.get<{ url: string }>(`/admin/async-jobs/${job.id}/result`, {
        headers: admin.headers,
      })
      const path = filesNamed(/muhasebe-paketi-.*\.zip$/).find((file) =>
        result.data.url.endsWith(file.split("/").pop() ?? "")
      )
      const entries = await readZipSafely(readFileSync(path ?? ""))
      const text = (prefix: string) =>
        entries.find((entry) => entry.name.startsWith(prefix))?.data.toString("utf8") ?? ""
      const sales = text("satislar-")
      const audit = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "accounting.package_made" })

      expect(job).toMatchObject({ status: "succeeded" })
      expect(job.result_summary).toMatchObject({ month: month(), orders: 2, corporate: 1 })
      expect(entries.map((entry) => entry.name).sort()).toEqual(
        [
          `hediye-kartlari-${month()}.csv`,
          `iadeler-${month()}.csv`,
          `kdv-ozeti-${month()}.csv`,
          `muhasebe-paketi-${month()}.xlsx`,
          `satislar-${month()}.csv`,
          `tahsilatlar-${month()}.csv`,
        ].sort()
      )
      expect(sales).toContain(`#${String(buyer.display_id)};`)
      expect(sales).toContain(`Kurumsal;${CORPORATE.legal_name};Kadıköy;${VKN}`)
      expect(sales).toContain("Bireysel;;;")
      // Gift cards sold (an advance) and spent, the month's amounts always written (adr/0025)
      expect(text("hediye-kartlari-")).toContain("Satılan hediye kartı (avans);Ay toplamı;;0")
      expect(text("hediye-kartlari-")).toContain("Kullanılan hediye kartı;Ay toplamı;;0")
      // Nothing of the individual: no name, no address, no email
      for (const name of [
        "satislar-",
        "iadeler-",
        "tahsilatlar-",
        "kdv-ozeti-",
        "hediye-kartlari-",
      ]) {
        expect(text(name)).not.toMatch(/Ayşe|Yılmaz|example\.com/)
      }
      expect(sales).not.toContain(`#${String((await customerOf(canceled)).display_id)};`)
      expect(text("tahsilatlar-")).toContain(`#${String(buyer.display_id)};`)
      expect(audit).toEqual([
        expect.objectContaining({
          kind: "sensitive_read",
          resource_id: month(),
          changes: expect.objectContaining({ customers: [buyer.customer_id] }) as unknown,
        }),
      ])
    })

    it("takes a month that has begun, in the last two years", async () => {
      const [year = 0] = month().split("-").map(Number)

      expect((await queue({ month: `${String(year + 1)}-01` })).status).toBe(400)
      expect((await queue({ month: `${String(year - 3)}-01` })).status).toBe(400)
      expect((await queue({ month: "2026-13" })).status).toBe(400)
    })
  },
})
