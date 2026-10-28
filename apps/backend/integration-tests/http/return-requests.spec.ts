import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { geliverOrder, geliverShop, shipOrder } from "../helpers/geliver"
import type { GeliverShop } from "../helpers/geliver"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const MINUTE = 60 * 1000

interface Request {
  id: string
  status: string
  return_code: string | null
  return_id: string | null
  refund_amount: string | null
  decision_note: string | null
}

/** F7.9 (adr/0032): from a shopper's request to the money back and the stock counted again. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeGeliver
    let setup: GeliverShop
    let customer: TestCustomer
    let clock = Date.now()

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    /** A Geliver order of the customer's, paid (captured), shipped and, unless told, delivered. */
    const deliveredOrder = async (deliver = true) => {
      const orderId = await geliverOrder(getContainer(), setup)
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(orderId, { customer_id: customer.id })
      const { data } = await query().graph({
        entity: "order",
        fields: ["items.id", "payment_collections.payments.id"],
        filters: { id: orderId },
      })
      const row = data[0] as {
        items: { id: string }[]
        payment_collections: { payments: { id: string }[] }[]
      }
      const paymentId = row.payment_collections[0]?.payments[0]?.id ?? ""
      await http.post(`/admin/payments/${paymentId}/capture`, {}, { headers: setup.admin.headers })
      if (deliver) {
        await shipOrder(http, setup, orderId)
        // Each read moves the test parcel on, to delivered on the fourth
        for (let step = 0; step < 4; step += 1) {
          clock += 30 * MINUTE
          await pollShipments(getContainer(), new Date(clock))
        }
      }
      return { orderId, lineId: row.items[0]?.id ?? "" }
    }
    const ask = (orderId: string, body: unknown) =>
      settle(
        http.post<{ return_request: Request; message?: string }>(
          `/store/orders/${orderId}/returns`,
          body,
          { headers: customer.headers }
        )
      )
    const staff = <T>(path: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    const stocked = async () => {
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["inventory_items.inventory.location_levels.stocked_quantity"],
        filters: { id: setup.variantId },
      })
      return (
        data[0] as {
          inventory_items: { inventory: { location_levels: { stocked_quantity: number }[] } }[]
        }
      ).inventory_items[0]?.inventory.location_levels[0]?.stocked_quantity
    }

    beforeAll(async () => {
      fake = await startFakeGeliver()
      process.env["GELIVER_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["GELIVER_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      setup = await geliverShop(http, getContainer(), fake)
      customer = await registerCustomer(http, await createStorefront(getContainer()))
    })

    it("takes a delivered line back: approved with Geliver's return code, received, refunded", async () => {
      const { orderId, lineId } = await deliveredOrder()
      const before = await stocked()

      const asked = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "damaged",
        note: "Kutu ezik geldi",
      })
      const twice = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "other",
      })
      const approved = await staff<{ return_request: Request }>(
        `/admin/return-requests/${asked.data.return_request.id}/approve`
      )
      const label = await settle(
        http.get<{ url: string }>(`/admin/return-requests/${asked.data.return_request.id}/label`, {
          headers: setup.admin.headers,
        })
      )
      const received = await staff<{ return_request: Request; refund_error: string | null }>(
        `/admin/return-requests/${asked.data.return_request.id}/receive`,
        { items: [{ line_item_id: lineId, quantity: 1 }] }
      )
      const { data: listed } = await http.get<{ return_requests: Request[] }>(
        `/admin/return-requests?order_id=${orderId}`,
        { headers: setup.admin.headers }
      )

      expect(asked.data.return_request).toMatchObject({ status: "requested" })
      expect(twice.data.message).toBe("returns.already_open")
      expect(approved.data.return_request).toMatchObject({ status: "approved" })
      expect(approved.data.return_request.return_code).toEqual(expect.any(String))
      expect(approved.data.return_request.return_id).toEqual(expect.any(String))
      expect(label.status).toBe(200)
      expect(received.data.refund_error).toBeNull()
      // The shop's fault: the 120 TL line and its 60 TL shipping come back
      expect(listed.return_requests[0]).toMatchObject({
        status: "refunded",
        refund_amount: "180.00",
      })
      expect(await stocked()).toBe((before ?? 0) + 1)
    })

    it("turns a request down with a note the shopper reads, and refuses what never shipped", async () => {
      const { orderId, lineId } = await deliveredOrder()
      const unshipped = await deliveredOrder(false)

      const asked = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "changed_mind",
      })
      await staff(`/admin/return-requests/${asked.data.return_request.id}/reject`, {
        note: "Kullanılmış ürün iade alınmıyor.",
      })
      const { data: mine } = await http.get<{ return_requests: Request[] }>(
        `/store/orders/${orderId}/returns`,
        { headers: customer.headers }
      )
      const tooMany = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 2 }],
        reason: "other",
      })
      const early = await ask(unshipped.orderId, {
        items: [{ line_item_id: unshipped.lineId, quantity: 1 }],
        reason: "other",
      })

      expect(mine.return_requests[0]).toMatchObject({
        status: "rejected",
        decision_note: "Kullanılmış ürün iade alınmıyor.",
      })
      expect(tooMany.data.message).toBe("returns.items_invalid")
      expect(early.data.message).toBe("returns.window_closed")
    })
  },
})
