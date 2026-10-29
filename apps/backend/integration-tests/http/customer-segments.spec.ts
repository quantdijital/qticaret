import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { PAYTR_ADDRESS } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface SegmentBody {
  segment?: { id: string; customer_group_id: string; member_count: number }
  message?: string
}

/** F10.3 (adr/0037 §6): segments by rules, filled into Medusa groups promotions can target. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let variantId: string
    let loyal: TestCustomer
    let newcomer: TestCustomer

    /** A paid order: a sale counts the money taken (an unpaid one counts for no one). */
    const orderFor = async (email: string, customerId?: string, paid = true) => {
      const orderId = await placeOrder(getContainer(), {
        regionId: shop.regionId,
        salesChannelId: shop.salesChannelId,
        shippingOptionId: shop.shippingOptionId,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: PAYTR_ADDRESS,
        email,
      })
      if (paid) {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "order",
            fields: ["payment_collections.payments.id"],
            filters: { id: orderId },
          })
        const paymentId = (data[0] as { payment_collections: { payments: { id: string }[] }[] })
          .payment_collections[0]?.payments[0]?.id
        await http.post(
          `/admin/payments/${paymentId ?? ""}/capture`,
          {},
          { headers: admin.headers }
        )
      }
      if (customerId) {
        await getContainer()
          .resolve(Modules.ORDER)
          .updateOrders(orderId, { customer_id: customerId })
      }
    }
    const membersOf = async (groupId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "customer_group", fields: ["customers.id"], filters: { id: groupId } })
      return ((data[0] as { customers?: { id: string }[] } | undefined)?.customers ?? [])
        .map(({ id }) => id)
        .sort()
    }
    const post = <T>(path: string, body: unknown) =>
      settle(http.post<T>(path, body, { headers: admin.headers }))

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 20, 120))
        .variantId
      const storefront = await createStorefront(container)
      loyal = await registerCustomer(http, storefront)
      newcomer = await registerCustomer(http, storefront)
      await orderFor(loyal.email, loyal.id)
      await orderFor(loyal.email, loyal.id)
      await orderFor(`misafir-${String(Date.now())}@example.com`)
    })

    it("fills a segment's group with the customers its rules take, and follows new rules and orders", async () => {
      const created = await post<SegmentBody>("/admin/customer-segments", {
        name: `Sadık ${String(Date.now())}`,
        rules: { min_orders: 2, registered: true },
      })
      const segment = created.data.segment
      const groupId = segment?.customer_group_id ?? ""
      const loyalOnly = await membersOf(groupId)

      const widened = await post<SegmentBody>(`/admin/customer-segments/${segment?.id ?? ""}`, {
        rules: { min_orders: 1, registered: true },
      })
      const afterWidening = await membersOf(groupId)
      await orderFor(newcomer.email, newcomer.id)
      const refreshed = await post<{ member_count: number }>(
        `/admin/customer-segments/${segment?.id ?? ""}/refresh`,
        {}
      )

      // The database outlives each test: earlier tests' customers may fit too
      const last = await membersOf(groupId)
      expect(created.status).toBe(201)
      expect(segment?.member_count).toBe(loyalOnly.length)
      expect(loyalOnly).toContain(loyal.id)
      expect(loyalOnly).not.toContain(newcomer.id)
      expect(widened.data.segment?.member_count).toBe(afterWidening.length)
      expect(afterWidening).not.toContain(newcomer.id)
      expect(refreshed.data.member_count).toBe(last.length)
      expect(last).toEqual(expect.arrayContaining([loyal.id, newcomer.id]))
    })

    it("takes spending in kuruş, and lets a segment go with its group", async () => {
      // Two orders placed but not paid (cash at the door, a transfer awaited): they spend nothing
      await orderFor(newcomer.email, newcomer.id, false)
      await orderFor(newcomer.email, newcomer.id, false)
      const created = await post<SegmentBody>("/admin/customer-segments", {
        name: `Çok harcayan ${String(Date.now())}`,
        // Two orders of 120 TL and shipping: over 200 TL
        rules: { min_total_spent: 200_00 },
      })
      const groupId = created.data.segment?.customer_group_id ?? ""
      const members = await membersOf(groupId)
      const removed = await settle(
        http.delete(`/admin/customer-segments/${created.data.segment?.id ?? ""}`, {
          headers: admin.headers,
        })
      )
      const { data: groups } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "customer_group", fields: ["id"], filters: { id: groupId } })

      expect(members).toContain(loyal.id)
      expect(members).not.toContain(newcomer.id)
      expect(removed.status).toBe(200)
      expect(groups).toHaveLength(0)
    })

    it("refuses a segment without rules, and anyone but staff", async () => {
      const empty = await post<SegmentBody>("/admin/customer-segments", { name: "Boş", rules: {} })
      const anonymous = await settle(http.get("/admin/customer-segments"))

      expect(empty.status).toBe(400)
      expect(empty.data.message).toBe("customer_segments.rules_empty")
      expect(anonymous.status).toBe(401)
    })
  },
})
