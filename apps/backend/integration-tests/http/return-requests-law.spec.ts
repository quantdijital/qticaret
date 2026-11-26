import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeAras } from "@qticaret/testing"
import type { FakeAras } from "@qticaret/testing"
import { pollShipments } from "../../src/jobs/shipment-tracking"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import {
  REFUND_DEADLINE_NEAR,
  alertRefundDeadlines,
} from "../../src/workflows/returns/refund-deadline"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import { carrierOrder, carrierShop, shipOrder } from "../helpers/carrier"
import type { CarrierShop } from "../helpers/carrier"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

interface Request {
  id: string
  status: string
  refund_amount: string | null
  refund_shipping: boolean
  refused_items: unknown
  handed_over_at: string | null
  refund_due_at: string | null
}

/**
 * adr/0032 Ek 2026-11-03: the returns flow held to the Mesafeli Sözleşmeler
 * Yönetmeliği as in force since 1.1.2026: a withdrawal refunds the outbound
 * shipping (md. 12/1), an opened sealed good is refused at receipt (md.
 * 15/1-ç), and the 14 days to refund are watched from the return parcel's
 * handover (md. 12/1).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeAras
    let setup: CarrierShop
    let customer: TestCustomer
    let clock = Date.now()

    const query = () => getContainer().resolve(ContainerRegistrationKeys.QUERY)
    /** An Aras order of the customer's, paid, shipped and delivered. */
    const deliveredOrder = async (quantity = 1) => {
      const orderId = await carrierOrder(getContainer(), setup, setup.variantId, quantity)
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
      await shipOrder(http, setup, orderId)
      for (let step = 0; step < 4; step += 1) {
        clock += 30 * MINUTE
        await pollShipments(getContainer(), new Date(clock))
      }
      return { orderId, lineId: row.items[0]?.id ?? "" }
    }
    const staff = <T>(path: string, body: unknown = {}) =>
      settle(http.post<T & { message?: string }>(path, body, { headers: setup.admin.headers }))
    /** The shopper asks (`changed_mind`, a withdrawal) and staff approve it. */
    const approved = async (orderId: string, lineId: string, quantity = 1) => {
      const asked = await settle(
        http.post<{ return_request: Request }>(
          `/store/orders/${orderId}/returns`,
          { items: [{ line_item_id: lineId, quantity }], reason: "changed_mind" },
          { headers: customer.headers }
        )
      )
      expect(asked.status).toBe(200)
      const id = asked.data.return_request.id
      expect((await staff(`/admin/return-requests/${id}/approve`)).status).toBe(200)
      return id
    }
    const requestOf = async (orderId: string, id: string) => {
      const { data } = await http.get<{ return_requests: Request[] }>(
        `/admin/return-requests?order_id=${orderId}`,
        { headers: setup.admin.headers }
      )
      return data.return_requests.find((request) => request.id === id)
    }
    const mark = async (excluded: boolean) => {
      const { data } = await query().graph({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: setup.variantId },
      })
      const productId = (data[0] as { product_id: string }).product_id
      await staff(`/admin/products/${productId}/catalog`, { withdrawal_excluded: excluded })
    }

    beforeAll(async () => {
      fake = await startFakeAras()
      process.env["ARAS_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["ARAS_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      setup = await carrierShop(http, getContainer(), fake)
      customer = await registerCustomer(http, await createStorefront(getContainer()))
    })

    it("gives a withdrawal's shipping back with the first part of the order, and only once (md. 12/1)", async () => {
      const { orderId, lineId } = await deliveredOrder(2)

      const first = await approved(orderId, lineId)
      const one = [{ line_item_id: lineId, quantity: 1 }]
      // Staff do not tick the shipping: the law gives it back anyway
      const firstBack = await staff(`/admin/return-requests/${first}/receive`, {
        items: one,
        refund_shipping: false,
      })
      const second = await approved(orderId, lineId)
      const secondBack = await staff(`/admin/return-requests/${second}/receive`, {
        items: one,
        refund_shipping: true,
      })

      expect([firstBack.status, secondBack.status]).toEqual([200, 200])
      // 120 TL unit and the 60 TL shipping, then the second unit alone
      expect(await requestOf(orderId, first)).toMatchObject({
        status: "refunded",
        refund_amount: "180.00",
        refund_shipping: true,
      })
      expect(await requestOf(orderId, second)).toMatchObject({
        status: "refunded",
        refund_amount: "120.00",
        refund_shipping: false,
      })
    })

    it("refuses an opened sealed good at receipt: not refunded, never asked again (md. 15/1-ç)", async () => {
      const { orderId, lineId } = await deliveredOrder(2)
      await mark(true)
      const id = await approved(orderId, lineId, 2)

      const tooMany = await staff(`/admin/return-requests/${id}/receive`, {
        items: [{ line_item_id: lineId, quantity: 1 }],
        refused: [{ line_item_id: lineId, quantity: 2 }],
      })
      const received = await staff<{ refund_error: string | null }>(
        `/admin/return-requests/${id}/receive`,
        {
          items: [{ line_item_id: lineId, quantity: 1 }],
          refused: [{ line_item_id: lineId, quantity: 1 }],
        }
      )
      const shopper = await settle(
        http.get<{ return_requests: { refused_items: unknown }[] }>(
          `/store/orders/${orderId}/returns`,
          { headers: customer.headers }
        )
      )
      const left = await settle(
        http.get<{ lines: { returnable: number }[] }>(`/store/orders/${orderId}/returnable`, {
          headers: customer.headers,
        })
      )

      expect(tooMany.data.message).toBe("returns.items_invalid")
      expect(received.data.refund_error).toBeNull()
      const refused = [{ line_item_id: lineId, quantity: 1, reason: "unsealed" }]
      // The sound unit and the shipping come back; the opened one does not
      expect(await requestOf(orderId, id)).toMatchObject({
        status: "refunded",
        refund_amount: "180.00",
        refused_items: refused,
      })
      expect(shopper.data.return_requests[0]?.refused_items).toEqual(refused)
      expect(left.data.lines[0]?.returnable).toBe(0)
    })

    it("refuses an opened sealed good alone with no money due, and nothing else as unsealed", async () => {
      const sealed = await deliveredOrder()
      await mark(true)
      const sealedId = await approved(sealed.orderId, sealed.lineId)
      const alone = await staff<{ refund_error: string | null }>(
        `/admin/return-requests/${sealedId}/receive`,
        { refused: [{ line_item_id: sealed.lineId, quantity: 1 }], refund_shipping: true }
      )
      await mark(false)
      const plain = await deliveredOrder()
      const plainId = await approved(plain.orderId, plain.lineId)
      const notSealed = await staff(`/admin/return-requests/${plainId}/receive`, {
        refused: [{ line_item_id: plain.lineId, quantity: 1 }],
      })

      expect(alone.status).toBe(200)
      expect(alone.data.refund_error).toBeNull()
      expect(await requestOf(sealed.orderId, sealedId)).toMatchObject({
        status: "received",
        refund_amount: null,
        refund_shipping: false,
      })
      expect(notSealed.status).toBe(400)
      expect(notSealed.data.message).toBe("returns.refusal_not_sealed")
      expect((await requestOf(plain.orderId, plainId))?.status).toBe("approved")
    })

    it("tells staff once on the 10th day since the parcel's recorded handover (md. 12/1)", async () => {
      const { orderId, lineId } = await deliveredOrder()
      const id = await approved(orderId, lineId)
      const handover = new Date(clock)
      await getContainer()
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .updateReturnRequests({ id, handed_over_at: handover })

      const recorded = await requestOf(orderId, id)
      const early = await alertRefundDeadlines(
        getContainer(),
        new Date(handover.getTime() + 9 * DAY)
      )
      const due = await alertRefundDeadlines(
        getContainer(),
        new Date(handover.getTime() + 10 * DAY)
      )
      const again = await alertRefundDeadlines(
        getContainer(),
        new Date(handover.getTime() + 11 * DAY)
      )
      const bells = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications(
          { channel: "feed", resource_id: id },
          { select: ["trigger_type", "data"] }
        )

      expect(recorded?.handed_over_at).toBe(handover.toISOString())
      expect(recorded?.refund_due_at).toBe(new Date(handover.getTime() + 14 * DAY).toISOString())
      expect([early, due, again]).toEqual([0, 1, 0])
      expect(bells.map((bell) => bell.trigger_type)).toEqual([REFUND_DEADLINE_NEAR])
      expect(bells[0]?.data).toMatchObject({
        return_request_id: id,
        due_at: new Date(handover.getTime() + 14 * DAY).toISOString(),
      })
    })
  },
})
