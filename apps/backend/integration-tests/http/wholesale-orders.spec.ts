import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { transferCartCustomerWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { eventually } from "../helpers/eventually"
import { createStorefront } from "../helpers/storefront"
import { accountApi, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface Board {
  orders: {
    id: string
    display_id: number
    wholesaler: { id: string; name: string | null } | null
  }[]
  count: number
  counts: Record<string, number>
  wholesale_matches: number
}

/**
 * ADR-0068 Ek 2026-11-15 (2): an order placed by an active wholesaler is
 * stamped wholesale once it is placed (the `order.placed` subscriber,
 * decided as of the order's time), and stays so after the account is closed. The panel's
 * retail list leaves it out before counting and paging, and says when a
 * search found it there; the wholesale list shows it with its wholesaler.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const board = (query: string) =>
      settle(http.get<Board>(`/admin/order-board?${query}`, { headers: admin.headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("keeps a wholesaler's order out of the retail list and in the wholesale one", async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const staff = wholesaleApi(http, admin.headers)
      const accounts = accountApi(http, admin.headers)
      await staff.flag(true)
      const store = await createStorefront(container)
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
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

      // The stamp is the order.placed subscriber's: written just after the order
      await eventually(
        () => board("stage=all&segment=wholesale"),
        (answer) => answer.data.orders.some((row) => row.id === wholesaleId)
      )
      const retail = await board("stage=all")
      expect(retail.status).toBe(200)
      const retailIds = retail.data.orders.map((row) => row.id)
      expect(retailIds).toContain(retailId)
      expect(retailIds).not.toContain(wholesaleId)
      expect(retail.data.counts["all"]).toBe(retail.data.count)

      const wholesale = await board(`stage=all&segment=wholesale&wholesaler=${account.id}`)
      expect(wholesale.data.orders.map((row) => [row.id, row.wholesaler?.name])).toEqual([
        [wholesaleId, "Kaya Bıçak Ltd"],
      ])

      // A search for its number in the retail list says where it is
      const number = wholesale.data.orders[0]?.display_id ?? 0
      const searched = await board(`stage=all&q=${String(number)}`)
      expect(searched.data.orders.map((row) => row.id)).not.toContain(wholesaleId)
      expect(searched.data.wholesale_matches).toBe(1)

      // Closed later, it was still placed at wholesale
      expect((await accounts.action(account.id, "deactivate")).status).toBe(200)
      const after = await board("stage=all&segment=wholesale")
      expect(after.data.orders.map((row) => row.id)).toContain(wholesaleId)
      // Operations ship them too, but see the company only and cannot narrow by wholesaler (L7)
      const operations = await createAdminUser(http, container, "operations")
      const shipped = await settle(
        http.get<Board>("/admin/order-board?stage=all&segment=wholesale", {
          headers: operations.headers,
        })
      )
      expect(shipped.status).toBe(200)
      expect(shipped.data.orders.find((row) => row.id === wholesaleId)?.wholesaler).toEqual({
        name: "Kaya Bıçak Ltd",
      })
      const narrowed = await settle(
        http.get(`/admin/order-board?segment=wholesale&wholesaler=${account.id}`, {
          headers: operations.headers,
        })
      )
      expect(narrowed.status).toBe(400)
      // The customer's page shows every order of theirs
      const theirs = await board(`stage=all&segment=all&customer_id=${customer.id}`)
      expect(theirs.data.orders.map((row) => row.id)).toContain(wholesaleId)
    })

    it("refuses an unknown segment", async () => {
      expect((await board("segment=b2b")).status).toBe(400)
    })
  },
})
