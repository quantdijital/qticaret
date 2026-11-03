import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGeliver } from "@qticaret/testing"
import type { FakeGeliver } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { SHIPMENT_TRACKING_MODULE } from "../../src/modules/shipment-tracking"
import type ShipmentTrackingModuleService from "../../src/modules/shipment-tracking/service"
import { createAdminUser } from "../helpers/admin"
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
    const deliveredOrder = async (deliver = true, quantity = 1) => {
      const orderId = await geliverOrder(getContainer(), setup, setup.variantId, quantity)
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
    const requestsOf = (orderId: string) =>
      settle(
        http.get<{ return_requests: { items: unknown[] }[] }>(
          `/admin/return-requests?order_id=${orderId}`,
          { headers: setup.admin.headers }
        )
      )
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
        { items: [{ line_item_id: lineId, quantity: 1 }], refund_shipping: true }
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
      // Staff found it the shop's fault: the 120 TL line and its 60 TL shipping come back
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

    it("takes a product outside the right of withdrawal back only as faulty, and keeps the shop's own period (F13.6)", async () => {
      const { orderId, lineId } = await deliveredOrder()
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: setup.variantId },
      })
      const productId = (data[0] as { product_id: string }).product_id
      await staff(`/admin/products/${productId}/catalog`, { withdrawal_excluded: true })

      const changedMind = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "changed_mind",
      })
      const shortPeriod = await staff("/admin/platform-settings/returns", { withdrawal_days: 7 })
      const faulty = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "damaged",
      })
      // Staff see the line marked as `/admin/orders/:id/returnable` marks it
      const listed = await requestsOf(orderId)
      const returnable = await settle(
        http.get<{ lines: { line_item_id: string; withdrawal_excluded: boolean }[] }>(
          `/admin/orders/${orderId}/returnable`,
          { headers: setup.admin.headers }
        )
      )
      const rejected = await staff<{ return_request: { items: unknown[] } }>(
        `/admin/return-requests/${faulty.data.return_request.id}/reject`,
        { note: "Kusur bulunamadı." }
      )
      await staff(`/admin/products/${productId}/catalog`, { withdrawal_excluded: false })
      const unmarked = await requestsOf(orderId)

      expect(changedMind.status).toBe(400)
      expect(changedMind.data.message).toBe("returns.withdrawal_excluded")
      // Never fewer than the law's 14 days
      expect(shortPeriod.status).toBe(400)
      expect(faulty.status).toBe(200)
      const marked = [
        {
          line_item_id: lineId,
          quantity: 1,
          withdrawal_excluded: true,
          withdrawal_excluded_reason: "product",
        },
      ]
      expect(listed.data.return_requests[0]?.items).toEqual(marked)
      expect(returnable.data.lines).toEqual([
        expect.objectContaining({ line_item_id: lineId, withdrawal_excluded: true }),
      ])
      expect(rejected.data.return_request.items).toEqual(marked)
      expect(unmarked.data.return_requests[0]?.items).toEqual([
        {
          line_item_id: lineId,
          quantity: 1,
          withdrawal_excluded: false,
          withdrawal_excluded_reason: null,
        },
      ])
    })

    it("refunds a damaged unit without restocking it, and the shipping only when staff say so", async () => {
      const { orderId, lineId } = await deliveredOrder(true, 2)
      const before = await stocked()
      const asked = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 2 }],
        reason: "damaged",
      })
      const id = asked.data.return_request.id
      await staff(`/admin/return-requests/${id}/approve`)

      const tooMany = await staff(`/admin/return-requests/${id}/receive`, {
        items: [{ line_item_id: lineId, quantity: 2 }],
        damaged: [{ line_item_id: lineId, quantity: 1 }],
      })
      const received = await staff<{ refund_error: string | null }>(
        `/admin/return-requests/${id}/receive`,
        {
          items: [{ line_item_id: lineId, quantity: 1 }],
          damaged: [{ line_item_id: lineId, quantity: 1 }],
        }
      )
      const again = await staff<{ return_request: Request }>(`/admin/return-requests/${id}/refund`)

      expect(tooMany.data.message).toBe("returns.items_invalid")
      expect(received.data.refund_error).toBeNull()
      // Two units of 120 TL back, the shipping kept: staff did not tick it
      expect(again.data.return_request).toMatchObject({
        status: "refunded",
        refund_amount: "240.00",
      })
      // Only the sound unit is sellable again
      expect(await stocked()).toBe((before ?? 0) + 1)
    })

    it("approves once when two clicks race, and keeps the request when the carrier refuses", async () => {
      const { orderId, lineId } = await deliveredOrder()
      const asked = await ask(orderId, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "changed_mind",
      })
      const id = asked.data.return_request.id
      const [parcel] = await getContainer()
        .resolve<ShipmentTrackingModuleService>(SHIPMENT_TRACKING_MODULE)
        .listTrackedShipments({ order_id: orderId })
      fake.queue(`POST /shipments/${parcel?.provider_shipment_id ?? ""}`, {
        status: 400,
        body: { result: false, code: "RETURN_NOT_ALLOWED" },
      })

      const refused = await staff(`/admin/return-requests/${id}/approve`)
      const { data: undone } = await query().graph({
        entity: "order",
        fields: ["items.detail.return_requested_quantity", "returns.id", "returns.status"],
        filters: { id: orderId },
      })
      const clicks = await Promise.all([
        staff(`/admin/return-requests/${id}/approve`),
        staff(`/admin/return-requests/${id}/approve`),
      ])
      const { data: after } = await query().graph({
        entity: "order",
        fields: ["returns.id", "returns.status"],
        filters: { id: orderId },
      })
      const open = (row: unknown) =>
        ((row as { returns?: { status: string }[] }).returns ?? []).filter(
          (each) => each.status !== "canceled"
        )

      expect(refused.status).toBeGreaterThanOrEqual(400)
      // Medusa's return undone with it: nothing held against the line
      expect(
        (undone[0] as { items: { detail: { return_requested_quantity: number } }[] }).items[0]
          ?.detail.return_requested_quantity
      ).toBe(0)
      expect(open(undone[0])).toHaveLength(0)
      expect(clicks.map((click) => click.status).sort()).toEqual([200, 400])
      expect(clicks.find((click) => click.status === 400)?.data.message).toBe(
        "returns.status_invalid"
      )
      expect(open(after[0])).toHaveLength(1)
    })

    it("hides another shopper's order, and closes Medusa's own return routes", async () => {
      const { orderId, lineId } = await deliveredOrder()
      const someoneElse = await registerCustomer(http, await createStorefront(getContainer()))

      const foreign = await settle(
        http.post<{ message?: string }>(
          `/store/orders/${orderId}/returns`,
          { items: [{ line_item_id: lineId, quantity: 1 }], reason: "other" },
          { headers: someoneElse.headers }
        )
      )
      const listed = await settle(
        http.get(`/store/orders/${orderId}/returns`, { headers: someoneElse.headers })
      )
      const storeReturn = await settle(
        http.post(
          "/store/returns",
          { order_id: orderId, items: [{ id: lineId, quantity: 1 }] },
          { headers: someoneElse.headers }
        )
      )
      const adminReturn = await staff("/admin/returns", { order_id: orderId })
      const adminExchange = await staff("/admin/exchanges", { order_id: orderId })

      expect(foreign.status).toBe(404)
      expect(listed.status).toBe(404)
      expect(storeReturn.status).toBe(404)
      expect(adminReturn.data.message).toBe("returns.use_return_requests")
      expect(adminExchange.data.message).toBe("returns.use_return_requests")
    })

    it("lets staff open one for the shopper who called, by the shopper's own rules (F12.3)", async () => {
      const { orderId, lineId } = await deliveredOrder()
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const options = await settle(
        http.get<{
          window_open: boolean
          open_request: boolean
          lines: { line_item_id: string; title: string | null; returnable: number }[]
        }>(`/admin/orders/${orderId}/returnable`, { headers: setup.admin.headers })
      )
      const body = {
        kind: "return",
        items: [{ line_item_id: lineId, quantity: 1 }],
        reason: "damaged",
      }
      const tooMany = await staff(`/admin/orders/${orderId}/return-requests`, {
        ...body,
        items: [{ line_item_id: lineId, quantity: 5 }],
      })
      const byReadonly = await settle(
        http.post(`/admin/orders/${orderId}/return-requests`, body, { headers: readonly.headers })
      )
      const opened = await staff<{ return_request: Request }>(
        `/admin/orders/${orderId}/return-requests`,
        body
      )
      const twice = await staff(`/admin/orders/${orderId}/return-requests`, body)
      const after = await settle(
        http.get<{ open_request: boolean; lines: { returnable: number }[] }>(
          `/admin/orders/${orderId}/returnable`,
          { headers: setup.admin.headers }
        )
      )
      // The shopper sees it as their own
      const shopperSees = await settle(
        http.get<{ return_requests: { id: string }[] }>(`/store/orders/${orderId}/returns`, {
          headers: customer.headers,
        })
      )

      expect(options.data).toMatchObject({ window_open: true, open_request: false })
      expect(options.data.lines).toEqual([
        expect.objectContaining({ line_item_id: lineId, returnable: 1 }),
      ])
      expect(tooMany.status).toBe(400)
      expect(byReadonly.status).toBe(403)
      expect(opened.status).toBe(201)
      expect(opened.data.return_request.status).toBe("requested")
      expect(twice.data.message).toBe("returns.already_open")
      expect(after.data.open_request).toBe(true)
      expect(shopperSees.data.return_requests.map((request) => request.id)).toEqual([
        opened.data.return_request.id,
      ])
    })
  },
})
