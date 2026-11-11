import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { LimitStanding, PlanSummary } from "../../src/lib/plan-limits"
import { createAdminUser } from "../helpers/admin"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { productBody, productCount, setPlanLimits } from "../helpers/plan-limits"
import type { Refusal } from "../helpers/plan-limits"
import { row, sheetClient, xlsxOf } from "../helpers/sheets"
import { orderOne, stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(300 * 1000)

/**
 * adr/0061 §5.3, Ek C14: a managed shop at its package's product limit.
 * A new product is refused however it is made (the form, Medusa's batch, a
 * copy, a sheet), a change to one that exists never is, nothing the shop
 * has is hidden or removed, and orders are never stopped by their limit.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const post = <T = Refusal>(url: string, body: unknown = {}) =>
      settle(http.post<T & Refusal>(url, body, { headers: admin.headers }))
    const sheets = sheetClient(http, getContainer, () => admin.headers)

    managedForThisFile()

    beforeEach(async () => {
      // The tables are emptied between tests, the plan state cache is not (the plan
      // guard reads it on every admin write, Ek C15): no limits again first
      await setPlanLimits(getContainer(), {})
      admin = await createAdminUser(http, getContainer())
    })

    it("refuses a new product at the limit, by every way in, and keeps what is there", async () => {
      const { salesChannelId } = await createStorefront(getContainer())
      await setPlanLimits(getContainer(), { products: 1 })

      const first = await post<{ product: { id: string } }>(
        "/admin/products",
        productBody("Şef Bıçağı", salesChannelId)
      )
      const second = await post("/admin/products", productBody("Ekmek Bıçağı", salesChannelId))
      const id = first.data.product.id
      const changed = await post(`/admin/products/${id}`, { title: "Şef Bıçağı 20 cm" })
      const copied = await post(`/admin/products/${id}/duplicate`)
      const batch = await post("/admin/products/batch", {
        create: [productBody("Sebze Bıçağı", salesChannelId)],
      })

      expect(first.status).toBe(200)
      expect(second.status).toBe(403)
      expect(second.data).toMatchObject({
        message: "plan.limit_reached",
        limit: "products",
        used: 1,
        max: 1,
      })
      expect(changed.status).toBe(200)
      expect(copied.status).toBe(403)
      expect(copied.data.message).toBe("plan.limit_reached")
      expect(batch.status).toBe(403)
      expect(await productCount(getContainer())).toBe(1)

      // A package lowered below what the shop has: nothing goes, changes still pass
      await setPlanLimits(getContainer(), { products: 0 })
      const read = await settle(http.get(`/admin/products/${id}`, { headers: admin.headers }))
      const renamed = await post(`/admin/products/${id}`, { status: "published" })
      expect(read.status).toBe(200)
      expect(renamed.status).toBe(200)
      expect(await productCount(getContainer())).toBe(1)
    })

    it("imports a sheet up to the limit and reports the rest, changes included", async () => {
      await stockShop(getContainer())
      const [existing] = await getContainer()
        .resolve(Modules.PRODUCT)
        .listProducts({}, { select: ["handle"], take: 1 })
      const base = await productCount(getContainer())
      await setPlanLimits(getContainer(), { products: base + 1 })
      const sheet = await xlsxOf([
        row({ handle: existing?.handle ?? "", title: "Yeni Adıyla" }),
        row({ handle: "limit-urun-1", title: "Birinci", price: 100 }),
        row({ handle: "limit-urun-2", title: "İkinci", price: 100 }),
        row({ handle: "limit-urun-3", title: "Üçüncü", price: 100 }),
      ])

      const checked = await sheets.upload(sheet, "check")
      const applied = await sheets.upload(sheet, "apply")
      const report = await sheets.fileOf(applied)
      const outcome = (handle: string) => report.find((cells) => cells[1] === handle)

      expect(checked.result_summary).toMatchObject({ create: 1, update: 1, limited: 2 })
      expect(applied.result_summary).toMatchObject({
        mode: "apply",
        create: 1,
        update: 1,
        limited: 2,
        failed: 0,
      })
      expect(outcome("limit-urun-1")?.[2]).toBe("Eklendi")
      expect(outcome("limit-urun-2")?.[2]).toBe("Paket limiti")
      expect(outcome("limit-urun-3")?.[4]).toMatch(/ürün limiti doldu/)
      expect(outcome(existing?.handle ?? "")?.[2]).toBe("Güncellendi")
      expect(await productCount(getContainer())).toBe(base + 1)
    })

    it("completes orders past the monthly order limit and shows it as a warning", async () => {
      const shop = await stockShop(getContainer())
      const { variantId } = await stockedProduct(getContainer(), shop, "limit-kupa", 10)
      await setPlanLimits(getContainer(), { orders_per_month: 1 })

      const first = await orderOne(getContainer(), shop, variantId)
      const second = await orderOne(getContainer(), shop, variantId)
      const { data } = await http.get<{ plan: PlanSummary }>("/admin/plan", {
        headers: admin.headers,
      })
      const orders = data.plan.limits.find((limit) => limit.key === "orders_per_month")

      expect(first).toBeTruthy()
      expect(second).toBeTruthy()
      expect(orders).toMatchObject<Partial<LimitStanding>>({ kind: "warn", used: 2, max: 1 })
    })

    it("tells the owner and admins the package, its limits and billing; no one else", async () => {
      const { salesChannelId } = await createStorefront(getContainer())
      await setPlanLimits(getContainer(), { products: 10, staff: 3 })
      await post("/admin/products", productBody("Şef Bıçağı", salesChannelId))
      const asAdmin = await createAdminUser(http, getContainer(), "admin")
      const asOps = await createAdminUser(http, getContainer(), "operations")
      const asReader = await createAdminUser(http, getContainer(), "readonly")
      const read = (headers: Record<string, string>) =>
        settle(http.get<{ plan: PlanSummary }>("/admin/plan", { headers }))

      const owner = await read(admin.headers)
      const statuses = await Promise.all(
        [asAdmin, asOps, asReader].map(async (user) => (await read(user.headers)).status)
      )

      expect(owner.status).toBe(200)
      expect(owner.headers["cache-control"]).toBe("no-store")
      expect(owner.data.plan).toMatchObject({
        managed: true,
        status: "active",
        package_code: "standart",
        warning_ratio: 0.8,
        payment_instruction: null,
        billing: { status: "active", currency: "TRY" },
      })
      expect(owner.data.plan.limits.find((limit) => limit.key === "products")).toMatchObject({
        kind: "block",
        used: 1,
        max: 10,
      })
      // Seats are members and open invitations (the panel's count may be a few seconds old)
      expect(owner.data.plan.limits.find((limit) => limit.key === "staff")).toMatchObject({
        max: 3,
        pending: 0,
      })
      expect(statuses).toEqual([200, 403, 403])
      expect((await settle(http.get("/admin/plan?x=1", { headers: admin.headers }))).status).toBe(
        400
      )
    })
  },
})
