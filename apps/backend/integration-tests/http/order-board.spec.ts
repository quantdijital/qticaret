import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import type { DemoStage } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(180 * 1000)

interface Board {
  orders: { id: string; display_id: number; stage: string; customer: { name: string | null } }[]
  count: number
  counts: Record<string, number>
  limited: boolean
}

async function firstId(container: MedusaContainer, entity: string, filters = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields: ["id"], filters })
  return (data[0] as { id: string } | undefined)?.id ?? ""
}

/** The panel's order list by stage (adr/0022): tabs, search, people only, reads recorded. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const get = (url: string) => settle(http.get<Board>(url, { headers: admin.headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("refuses an unknown stage, unknown parameters and anonymous requests", async () => {
      const bad = await get("/admin/order-board?stage=lost")
      const extra = await get("/admin/order-board?limit=5000")
      const anonymous = await settle(http.get("/admin/order-board"))

      expect(bad.status).toBe(400)
      expect(extra.status).toBe(400)
      expect(anonymous.status).toBe(401)
    })

    it("sorts orders into stages, searches them and records the read", async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const option = await firstId(container, "shipping_option", {
        name: DEMO_SHIPPING_OPTIONS[0].name,
      })
      const variant = await firstId(container, "product_variant")
      const place = async (stage: DemoStage, lastName: string) => {
        const orderId = await placeOrder(container, {
          regionId,
          salesChannelId,
          shippingOptionId: option,
          items: [{ variant_id: variant, quantity: 1 }],
          address: { first_name: "Ayşe", last_name: lastName, address_1: "Demo Sokak 1" },
        })
        await advanceOrder(container, orderId, stage)
      }
      await place("to_ship", "Yılmaz")
      await place("to_ship", "Demir")
      await place("shipped", "Kaya")
      await place("canceled", "Şahin")

      const all = await get("/admin/order-board")
      const toShip = await get("/admin/order-board?stage=to_ship")
      const search = await get("/admin/order-board?q=Kaya")

      expect(all.status).toBe(200)
      expect(all.data.counts).toMatchObject({ all: 4, to_ship: 2, shipped: 1, canceled: 1 })
      expect(all.data.limited).toBe(false)
      // Newest first
      expect(all.data.orders[0]?.customer.name).toBe("Ayşe Şahin")
      expect(toShip.data.count).toBe(2)
      expect(toShip.data.orders.every((order) => order.stage === "to_ship")).toBe(true)
      expect(search.data.orders.map((order) => order.customer.name)).toEqual(["Ayşe Kaya"])

      let recorded = 0
      for (let attempt = 0; attempt < 30 && recorded === 0; attempt++) {
        const { data } = await http.get<{ audit_entries: { resource_id: string | null }[] }>(
          "/admin/audit-log?kind=sensitive_read&resource_type=order",
          { headers: admin.headers }
        )
        recorded = data.audit_entries.length
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      expect(recorded).toBeGreaterThan(0)
    })
  },
})
