import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { transferCartCustomerWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { accountApi, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface Alerts {
  notifications: { id: string; data: Record<string, unknown> | null; read: boolean }[]
  count: number
  unread: number
}

/**
 * The bell (adr/0020) and a wholesaler's order (ADR-0068). Before, the
 * only order that wrote to the bell was one paid by bank transfer
 * (`staff-order-alerts`): a wholesaler paying any other way reached no
 * one. Now the stamp writes one alert, named by its wholesaler, shown to
 * the roles that see wholesalers; what each person has read is theirs.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const alerts = (headers: Record<string, string>, query = "") =>
      settle(http.get<Alerts>(`/admin/alerts${query ? `?${query}` : ""}`, { headers }))
    const read = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post("/admin/alerts/read", body, { headers }))

    it("puts a wholesaler's order in the bell of those who see wholesalers, read per person", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const { regionId, salesChannelId } = await seedDemo(container)
      await wholesaleApi(http, admin.headers).flag(true)
      const store = await createStorefront(container)
      const customer = await registerCustomer(http, store)
      await accountApi(http, admin.headers).made({
        email: customer.email,
        contact_name: "Ali Kaya",
        company_name: "Kaya Bıçak Ltd",
        own_prices: true,
      })
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: options } = await query.graph({
        entity: "shipping_option",
        fields: ["id"],
        filters: { name: DEMO_SHIPPING_OPTIONS[0].name },
      })
      const { data: variants } = await query.graph({ entity: "product_variant", fields: ["id"] })
      // Paid as by card (the system provider): no bank transfer to wait for
      const order = (beforeComplete?: (cartId: string) => Promise<void>) =>
        placeOrder(container, {
          regionId,
          salesChannelId,
          shippingOptionId: (options[0] as { id: string }).id,
          items: [{ variant_id: (variants[0] as { id: string }).id, quantity: 1 }],
          address: { first_name: "Ali", last_name: "Kaya", address_1: "Demo Sokak 1" },
          beforeComplete,
        })
      const retailId = await order()
      const wholesaleId = await order(async (cartId) => {
        await transferCartCustomerWorkflow(container).run({
          input: { id: cartId, customer_id: customer.id },
        })
      })

      const mine = await eventually(
        () => alerts(admin.headers),
        (answer) => answer.data.notifications.some((row) => row.data?.["order_id"] === wholesaleId)
      )
      const alert = mine.data.notifications.find((row) => row.data?.["order_id"] === wholesaleId)
      expect(alert?.data).toMatchObject({ kind: "wholesale_order", company: "Kaya Bıçak Ltd" })
      expect(alert?.read).toBe(false)
      expect(mine.data.unread).toBeGreaterThanOrEqual(1)
      // One row per order in Medusa's feed; a card-paid retail order writes none
      const feed = container.resolve(Modules.NOTIFICATION)
      expect(
        await feed.listNotifications({ channel: "feed", resource_id: wholesaleId })
      ).toHaveLength(1)
      expect(await feed.listNotifications({ channel: "feed", resource_id: retailId })).toHaveLength(
        0
      )

      // By group
      const grouped = await alerts(admin.headers, "group=wholesale")
      expect(grouped.data.notifications.map((row) => row.id)).toContain(alert?.id)
      const stock = await alerts(admin.headers, "group=stock")
      expect(stock.data.notifications.map((row) => row.id)).not.toContain(alert?.id)

      // Operations do not see wholesalers (ADR-0068 §9): not in their bell, nor its count
      const operations = await createAdminUser(http, container, "operations")
      const theirs = await alerts(operations.headers)
      expect(theirs.status).toBe(200)
      expect(theirs.data.notifications.map((row) => row.id)).not.toContain(alert?.id)
      expect(theirs.data.unread).toBe(0)

      // Read by this person only
      expect((await read(admin.headers, { ids: [alert?.id] })).status).toBe(200)
      const after = await alerts(admin.headers)
      expect(after.data.notifications.find((row) => row.id === alert?.id)?.read).toBe(true)
      expect(
        (await alerts(admin.headers, "state=unread")).data.notifications.map((row) => row.id)
      ).not.toContain(alert?.id)
      expect(
        (await alerts(admin.headers, "state=read")).data.notifications.map((row) => row.id)
      ).toContain(alert?.id)
      const other = await createAdminUser(http, container, "admin")
      // Someone who joined after it never has it unread: their floor is when they joined
      const others = await alerts(other.headers)
      expect(others.data.notifications.find((row) => row.id === alert?.id)?.read).toBe(true)
      expect(others.data.unread).toBe(0)

      // All read
      expect((await read(operations.headers, { all: true })).status).toBe(200)
      expect((await alerts(operations.headers, "state=unread")).data.count).toBe(0)
    })

    it("refuses a mark with neither ids nor all, or both", async () => {
      const admin = await createAdminUser(http, getContainer())
      expect((await read(admin.headers, {})).status).toBe(400)
      expect((await read(admin.headers, { ids: ["noti_1"], all: true })).status).toBe(400)
      expect((await alerts(admin.headers, "group=nope")).status).toBe(400)
    })
  },
})
