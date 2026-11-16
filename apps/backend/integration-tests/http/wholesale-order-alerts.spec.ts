import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { transferCartCustomerWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { READ_STATE_KEY } from "../../src/lib/notifications/feed"
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

interface Row {
  id: string
  created_at: string
  data: Record<string, unknown> | null
  read: boolean
}

interface Alerts {
  notifications: Row[]
  count: number
  unread: number
}

/**
 * The bell (adr/0020) and a wholesaler's order (ADR-0068). Before, the
 * only order that wrote to the bell was one paid by bank transfer
 * (`staff-order-alerts`): a wholesaler paying any other way reached no
 * one. Now each placed order rings once: a wholesaler's its own alert,
 * shown to the roles that see wholesalers and named on the page (a
 * recorded read), never in the bell; what each person has read is theirs.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const alerts = (headers: Record<string, string>, query = "") =>
      settle(http.get<Alerts>(`/admin/alerts${query ? `?${query}` : ""}`, { headers }))
    const bell = (headers: Record<string, string>) =>
      settle(http.get<{ notifications: Row[]; unread: number }>("/admin/alerts/bell", { headers }))
    const read = (headers: Record<string, string>, body: Record<string, unknown>) =>
      settle(http.post("/admin/alerts/read", body, { headers }))
    const recordedReads = () =>
      getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ kind: "sensitive_read", resource_type: "notification" })

    it("rings once for a wholesaler's order, for those who see wholesalers, read per person", async () => {
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
      const feed = container.resolve(Modules.NOTIFICATION)
      const rowsOf = (orderId: string) =>
        feed.listNotifications(
          { channel: "feed", resource_id: orderId },
          { select: ["trigger_type", "data"] }
        )

      // One row per order: the wholesale one for the wholesaler's, "new order" for the other
      await eventually(
        () => Promise.all([rowsOf(wholesaleId), rowsOf(retailId)]),
        ([wholesale, retail]) => wholesale.length > 0 && retail.length > 0
      )
      await new Promise((resolve) => setTimeout(resolve, 500))
      expect((await rowsOf(wholesaleId)).map((row) => row.trigger_type)).toEqual([
        "wholesale.order_placed",
      ])
      expect((await rowsOf(retailId)).map((row) => row.trigger_type)).toEqual(["orders.new_order"])

      // The bell: no company, no account, and no recorded read for it
      const before = (await recordedReads()).length
      const rung = await bell(admin.headers)
      expect(rung.status).toBe(200)
      const short = rung.data.notifications.find((row) => row.data?.["order_id"] === wholesaleId)
      expect(short?.data).toMatchObject({ kind: "wholesale_order", bank_transfer: false })
      expect(short?.data).not.toHaveProperty("company")
      expect(short?.data).not.toHaveProperty("account_id")
      expect(JSON.stringify(rung.data)).not.toContain("Kaya")
      expect(rung.data.unread).toBeGreaterThanOrEqual(2)
      expect(
        (await settle(http.get("/admin/alerts/bell?group=wholesale", { headers: admin.headers })))
          .status
      ).toBe(400)
      expect((await recordedReads()).length).toBe(before)

      // The page names the company, and that read is recorded; a page without one is not
      const mine = await alerts(admin.headers)
      const alert = mine.data.notifications.find((row) => row.data?.["order_id"] === wholesaleId)
      expect(alert?.data).toMatchObject({ kind: "wholesale_order", company: "Kaya Bıçak Ltd" })
      expect(alert?.read).toBe(false)
      expect((await recordedReads()).length).toBe(before + 1)
      await alerts(admin.headers, "group=stock")
      expect((await recordedReads()).length).toBe(before + 1)

      // By group
      const grouped = await alerts(admin.headers, "group=wholesale")
      expect(grouped.data.notifications.map((row) => row.id)).toEqual([alert?.id])

      // Operations do not see wholesalers (ADR-0068 §9): not on the page, in the bell nor its count
      const operations = await createAdminUser(http, container, "operations")
      const theirs = await alerts(operations.headers)
      expect(theirs.status).toBe(200)
      expect(theirs.data.notifications.map((row) => row.id)).not.toContain(alert?.id)
      expect(
        (await bell(operations.headers)).data.notifications.map((row) => row.id)
      ).not.toContain(alert?.id)
      // Nor do they mark it: a hidden alert's id is not kept, and "all read" stops before it
      expect((await read(operations.headers, { ids: [alert?.id] })).status).toBe(200)
      const users = container.resolve(Modules.USER)
      const stateOf = async (userId: string) =>
        (await users.retrieveUser(userId, { select: ["metadata"] })).metadata?.[READ_STATE_KEY] as
          { until: string | null; ids: string[] } | undefined
      expect((await stateOf(operations.userId))?.ids ?? []).not.toContain(alert?.id)
      expect((await read(operations.headers, { all: true })).status).toBe(200)
      const until = (await stateOf(operations.userId))?.until ?? ""
      const retailRow = mine.data.notifications.find((row) => row.data?.["order_id"] === retailId)
      // The newest alert they get (the retail order's), whichever was written last
      expect(new Date(until).getTime()).toBe(new Date(retailRow?.created_at ?? 0).getTime())

      // Read by this person only; the state's own key written, the rest of the metadata kept
      await users.updateUsers({ id: admin.userId, metadata: { kept: "yes" } })
      expect((await read(admin.headers, { ids: [alert?.id] })).status).toBe(200)
      const after = await alerts(admin.headers)
      expect(after.data.notifications.find((row) => row.id === alert?.id)?.read).toBe(true)
      expect(
        (await users.retrieveUser(admin.userId, { select: ["metadata"] })).metadata
      ).toMatchObject({ kept: "yes", [READ_STATE_KEY]: { ids: [alert?.id] } })
      expect(
        (await alerts(admin.headers, "state=unread")).data.notifications.map((row) => row.id)
      ).not.toContain(alert?.id)
      expect(
        (await alerts(admin.headers, "state=read")).data.notifications.map((row) => row.id)
      ).toContain(alert?.id)
      // Someone who joined after it never has it unread: their floor is when they joined
      const other = await createAdminUser(http, container, "admin")
      const others = await alerts(other.headers)
      expect(others.data.notifications.find((row) => row.id === alert?.id)?.read).toBe(true)
      expect(others.data.unread).toBe(0)
    })

    it("refuses a mark with neither ids nor all, or both", async () => {
      const admin = await createAdminUser(http, getContainer())
      expect((await read(admin.headers, {})).status).toBe(400)
      expect((await read(admin.headers, { ids: ["noti_1"], all: true })).status).toBe(400)
      expect((await alerts(admin.headers, "group=nope")).status).toBe(400)
    })
  },
})
