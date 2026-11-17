import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import { createAdminUser } from "../helpers/admin"
import { settle } from "../helpers/http"
import { iyzicoFailure, iyzicoRefundShop } from "../helpers/iyzico-refunds"
import { defined } from "../helpers/refunds"

jest.setTimeout(120 * 1000)

const IN_PART = { outcome: "made_in_part" }

/**
 * D4-1 (follow-up of PR #153), security review: what closing an iyzico
 * refund in part refuses, and what a flow's own refund made in part does
 * instead. A part iyzico refused with a code not known to make nothing
 * may have been made (S2); a cancel's or a return's refund is its flow's
 * (S1), and the flow run again sends only what is left (M1); only owner
 * and admin may close one.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const shop = iyzicoRefundShop(api, getContainer)
    const { http, paidOrder, refund, check, entryOf, sentFor, halfway } = shop

    it("keeps a part iyzico refused with a code not known to make nothing unanswered (S2)", async () => {
      const { orderId } = await paidOrder()
      const reference = "c0000000000000000000000000000001"
      halfway(iyzicoFailure("10051"))
      const sent = await refund(orderId, { amount: 300, reference })

      const checked = await check(orderId, reference, IN_PART)
      const open = await entryOf(reference)

      expect(sent.data.message).toBe("iyzico.refund_outcome_unknown")
      // It may have been made: staff answer for it first (M2)
      expect(checked.status).toBe(409)
      expect(checked.data.message).toBe("orders.refund_lost_part_required")
      expect(open).toMatchObject({ status: "pending", amount: 30000 })
      expect(open.provider_parts).toEqual([
        expect.objectContaining({ amount: 24000, state: "done" }),
        expect.objectContaining({ amount: 6000, state: "sending" }),
      ])
    })

    it("leaves a cancel's refund made in part to the cancel, which sends only the rest (S1, M1)", async () => {
      const { orderId, paymentId } = await paidOrder()
      // The whole payment back by item transaction: the shipping's part refused (5093)
      halfway(iyzicoFailure("5093"))
      const cancel = () =>
        settle(
          http.post<{ order?: { status: string } }>(
            `/admin/orders/${orderId}/cancel`,
            {},
            { headers: shop.admin().headers }
          )
        )
      const stopped = await cancel()
      const [entry] = await shop.ledger().listOrderRefunds({ order_id: orderId })
      const reference = defined(entry, "cancel's ledger entry").reference

      const checked = await check(orderId, reference, IN_PART)
      const again = await cancel()
      const closed = await entryOf(reference)

      expect(stopped.status).toBeGreaterThanOrEqual(400)
      expect(reference).toMatch(/^cancel/)
      expect(checked.status).toBe(409)
      expect(checked.data.message).toBe("orders.refund_in_part_flow_owned")
      expect(again.status).toBe(200)
      expect(again.data.order).toMatchObject({ status: "canceled" })
      expect(closed).toMatchObject({ status: "done", amount: 33000 })
      // The rest alone went: the cups' part never again, the shipping's once
      expect(shop.fake().refunds.get(`${paymentId}01`)).toEqual([24000])
      expect(shop.fake().refunds.get(`${paymentId}02`)).toEqual([9000])
      expect(sentFor(reference)).toBe(3)
    })

    it("leaves a return's refund made in part to the return, which sends only the rest (S1, M1)", async () => {
      const { orderId, paymentId } = await paidOrder()
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["items.id"], filters: { id: orderId } })
      const lineId = (data[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const back = [{ line_item_id: lineId, quantity: 2 }]
      // Received already: what came back and its shipping, to be refunded
      const request = await getContainer()
        .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
        .createReturnRequests({
          order_id: orderId,
          status: "received",
          reason: "damaged",
          items: back,
          received_items: back,
          refund_shipping: true,
        } as never)
      const refundReturn = () =>
        settle(
          http.post<{ return_request?: { status: string; refund_amount: string } }>(
            `/admin/return-requests/${request.id}/refund`,
            {},
            { headers: shop.admin().headers }
          )
        )
      halfway(iyzicoFailure("5093"))
      const stopped = await refundReturn()
      const reference = `return${request.id.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 40)

      const checked = await check(orderId, reference, IN_PART)
      const again = await refundReturn()
      const closed = await entryOf(reference)

      expect(stopped.status).toBeGreaterThanOrEqual(400)
      expect(checked.data.message).toBe("orders.refund_in_part_flow_owned")
      expect(again.data.return_request).toMatchObject({
        status: "refunded",
        refund_amount: "330.00",
      })
      expect(closed).toMatchObject({ status: "done", amount: 33000 })
      expect(shop.fake().refunds.get(`${paymentId}01`)).toEqual([24000])
      expect(shop.fake().refunds.get(`${paymentId}02`)).toEqual([9000])
      expect(sentFor(reference)).toBe(3)
    })

    it("is for owner and admin only", async () => {
      const { orderId } = await paidOrder()
      const reference = "c0000000000000000000000000000003"
      halfway(iyzicoFailure("5093"))
      await refund(orderId, { amount: 300, reference })
      const container = getContainer()
      const operations = await createAdminUser(http, container, "operations")
      const readonly = await createAdminUser(http, container, "readonly")
      const shopAdmin = await createAdminUser(http, container, "admin")

      const denied = [
        await check(orderId, reference, IN_PART, operations.headers),
        await check(orderId, reference, IN_PART, readonly.headers),
      ]
      const untouched = await entryOf(reference)
      const allowed = await check(orderId, reference, IN_PART, shopAdmin.headers)

      expect(denied.map(({ status }) => status)).toEqual([403, 403])
      expect(untouched).toMatchObject({ status: "pending", amount: 30000 })
      expect(allowed.data.refund).toMatchObject({ status: "done" })
    })
  },
})
