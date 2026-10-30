import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { clearDashboardCache } from "../../src/api/admin/dashboard/overview/read"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import type { DemoStage } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { ACCOUNTING_MODULE } from "../../src/modules/accounting"
import type AccountingModuleService from "../../src/modules/accounting/service"
import { TENANT_WEBHOOKS_MODULE } from "../../src/modules/tenant-webhooks"
import type TenantWebhooksModuleService from "../../src/modules/tenant-webhooks/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface Overview {
  totals: { sales: { current: string }; orders: { current: number }; units: { current: number } }
  statuses: Record<string, number>
  top_products: { title: string; units: number }[]
  categories: { name: string | null }[]
}

async function firstId(container: MedusaContainer, entity: string, filters = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields: ["id"], filters })
  return (data[0] as { id: string } | undefined)?.id ?? ""
}

/** The panel's dashboard (adr/0022): numbers from real checkouts, people only, reads recorded. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const get = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))

    beforeEach(async () => {
      clearDashboardCache()
      admin = await createAdminUser(http, getContainer())
    })

    it("answers zeros for a shop without orders", async () => {
      const overview = await get<Overview>("/admin/dashboard/overview?period=7d")
      const tasks = await get<Record<string, number>>("/admin/dashboard/tasks")
      const recent = await get<{ orders: unknown[] }>("/admin/dashboard/recent-orders")

      expect(overview.status).toBe(200)
      expect(overview.data.totals.orders.current).toBe(0)
      expect(overview.data.totals.sales.current).toBe("0.00")
      expect(tasks.data).toMatchObject({
        to_ship: 0,
        awaiting_payment: 0,
        orphan_payments: { refunding: 0, by_hand: 0 },
        // Neither in use: nothing to count
        accounting_stopped: null,
        webhooks_disabled: null,
      })
      expect(recent.data.orders).toEqual([])
    })

    it("counts records the accounting program refused and hooks turned off after failing (F12.1)", async () => {
      const container = getContainer()
      await http.post(
        "/admin/platform-settings/accounting",
        { adapter: "fake" },
        { headers: admin.headers }
      )
      await container.resolve<AccountingModuleService>(ACCOUNTING_MODULE).createAccountingSyncs([
        {
          adapter: "fake",
          source_type: "sale",
          source_id: "order_1",
          status: "stopped",
          next_attempt_at: new Date(),
        },
        {
          adapter: "fake",
          source_type: "sale",
          source_id: "order_2",
          status: "synced",
          next_attempt_at: new Date(),
        },
      ])
      const hooks = container.resolve<TenantWebhooksModuleService>(TENANT_WEBHOOKS_MODULE)
      await hooks.subscribe({
        url: "https://erp.example.com/a",
        events: ["order.placed"],
        created_by: null,
      })
      const { subscription } = await hooks.subscribe({
        url: "https://erp.example.com/b",
        events: ["order.placed"],
        created_by: null,
      })
      await hooks.updateWebhookSubscriptions({ id: subscription.id, status: "disabled" })

      const tasks = await get<Record<string, unknown>>("/admin/dashboard/tasks")

      expect(tasks.data).toMatchObject({ accounting_stopped: 1, webhooks_disabled: 1 })
    })

    it("refuses an unknown period and requests without a signed-in user", async () => {
      const bad = await get("/admin/dashboard/overview?period=1y")
      const anonymous = await settle(http.get("/admin/dashboard/overview"))

      expect(bad.status).toBe(400)
      expect(anonymous.status).toBe(401)
    })

    it("counts checkouts by stage and sales, and records the recent orders read", async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const option = await firstId(container, "shipping_option", {
        name: DEMO_SHIPPING_OPTIONS[0].name,
      })
      const variant = await firstId(container, "product_variant")
      const place = async (stage: DemoStage) => {
        const orderId = await placeOrder(container, {
          regionId,
          salesChannelId,
          shippingOptionId: option,
          items: [{ variant_id: variant, quantity: 2 }],
          address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
        })
        await advanceOrder(container, orderId, stage)
      }
      await place("delivered")
      await place("to_ship")
      await place("canceled")

      const overview = await get<Overview>("/admin/dashboard/overview?period=today")
      const tasks = await get<Record<string, number>>("/admin/dashboard/tasks")
      const recent = await get<{ orders: { stage: string; customer: { name: string } }[] }>(
        "/admin/dashboard/recent-orders"
      )

      expect(overview.data.totals.orders.current).toBe(2)
      expect(overview.data.totals.units.current).toBe(4)
      expect(Number(overview.data.totals.sales.current)).toBeGreaterThan(0)
      expect(overview.data.statuses).toMatchObject({ delivered: 1, to_ship: 1, canceled: 1 })
      expect(overview.data.top_products[0]?.units).toBe(4)
      expect(tasks.data["to_ship"]).toBe(1)
      expect(recent.data.orders).toHaveLength(3)
      expect(recent.data.orders[0]?.customer.name).toBe("Ayşe Yılmaz")

      let recorded = 0
      for (let attempt = 0; attempt < 30 && recorded === 0; attempt++) {
        const { data } = await http.get<{ audit_entries: unknown[] }>(
          "/admin/audit-log?kind=sensitive_read&resource_type=order",
          { headers: admin.headers }
        )
        recorded = data.audit_entries.length
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(recorded).toBeGreaterThan(0)
    })

    it("answers the sales report with the overview's totals, for people only", async () => {
      const report = await get<Overview>("/admin/reports/sales?period=30d")
      const overview = await get<Overview>("/admin/dashboard/overview?period=30d")
      const anonymous = await settle(http.get("/admin/reports/sales"))
      const bad = await get("/admin/reports/sales?period=1y")

      expect(report.status).toBe(200)
      expect(report.data.totals).toEqual(overview.data.totals)
      expect(anonymous.status).toBe(401)
      expect(bad.status).toBe(400)
    })

    it("reports how complete the catalog is", async () => {
      await seedDemo(getContainer())

      const health = await get<{
        products: number
        without_image: number
        missing_dimensions: number
      }>("/admin/dashboard/catalog-health")

      expect(health.status).toBe(200)
      expect(health.data.products).toBeGreaterThan(0)
      // Demo products have no images, but carry weight and dimensions (F3.1)
      expect(health.data.without_image).toBe(health.data.products)
      expect(health.data.missing_dimensions).toBe(0)
    })
  },
})
