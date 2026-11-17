import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, paytrNotification, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import {
  PAYTR_ADDRESS,
  connectPaytr,
  notifyPaytr,
  orderOfCart,
  readyCart,
  startPaytrPayment,
} from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

// A made-up PayTR account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()

/**
 * Review 2026-11-17: a refund PayTR made whose ledger entry could not be
 * closed stays counted (pending, `refund_incomplete`), the shop is told,
 * and the same reference closes it without a second refund. A cancel
 * leaves no payment naming a refund (review D1).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** Two cups (120 each) and shipping (90), paid with PayTR: 330 TL. */
    const paidOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId, PAYTR_ADDRESS, 2)
      const reference = await startPaytrPayment(http, storefront.headers, cartId)
      fake.pay(reference)
      await notifyPaytr(
        http,
        paytrNotification(account, {
          merchantOid: reference,
          status: "success",
          paymentAmount: 33000,
          testMode: true,
        })
      )
      const payment = fake.payments.get(reference)
      if (payment) {
        payment.notified = true
      }
      return { orderId: (await orderOfCart(getContainer(), cartId)) ?? "", reference }
    }
    const refund = (orderId: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ refund: { amount: string; made_before: boolean }; message?: string }>(
          `/admin/orders/${orderId}/refunds`,
          body,
          { headers: admin.headers }
        )
      )
    const itemOf = async (orderId: string) => {
      const { data } = await http.get<{ money: { lines: { id: string; kind: string }[] } }>(
        `/admin/orders/${orderId}/money`,
        { headers: admin.headers }
      )
      return data.money.lines.find((line) => line.kind === "item")?.id ?? ""
    }
    const ledger = () => getContainer().resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const paymentOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["payment_collections.payments.id", "payment_collections.payments.data"],
          filters: { id: orderId },
        })
      const order = data[0] as {
        payment_collections: { payments: { id: string; data: Record<string, unknown> }[] }[]
      }
      return order.payment_collections[0]?.payments[0]
    }

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      process.env["PAYTR_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await connectPaytr(http, container, account)
    })

    it("keeps a refund PayTR made counted when its record fails, and closes it once", async () => {
      const { orderId, reference } = await paidOrder()
      const item = await itemOf(orderId)
      const body = { items: [{ id: item, quantity: 2 }], reference: "refund0000000031" }
      // The ledger cannot close the entry once: PayTR has given the money back by then
      const service = ledger()
      const update = service.updateOrderRefunds.bind(service) as (data: unknown) => Promise<unknown>
      let broken = false
      const spy = jest.spyOn(service, "updateOrderRefunds").mockImplementation(((data: unknown) => {
        if (!broken && (data as { status?: string }).status === "done") {
          broken = true
          return Promise.reject(new Error("ledger unavailable"))
        }
        return update(data)
      }) as never)

      const failed = await refund(orderId, body)
      spy.mockRestore()
      const [entry] = await service.listOrderRefunds({ reference: body.reference })
      // Its units stay counted: a new request cannot give them back again
      const twice = await refund(orderId, {
        items: [{ id: item, quantity: 1 }],
        reference: "refund0000000032",
      })
      const details = await http.get<{ refunds: { reference: string; incomplete: boolean }[] }>(
        `/admin/orders/${orderId}/payment-details`,
        { headers: admin.headers }
      )
      const alerts = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ trigger_type: "payments.refund_incomplete" }, { select: ["data"] })
      const again = await refund(orderId, body)
      const [closed] = await service.listOrderRefunds({ reference: body.reference })
      const { data: payments } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "payment", fields: ["refunds.id"], filters: { id: entry?.payment_id } })

      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(entry).toMatchObject({ status: "pending", error_code: "refund_incomplete" })
      expect(twice.data).toMatchObject({ message: "orders.refund_units_exceeded" })
      expect(details.data.refunds).toEqual([
        expect.objectContaining({ reference: body.reference, incomplete: true }),
      ])
      expect(alerts.map(({ data }) => data)).toEqual([
        expect.objectContaining({ issue: "refund_incomplete", cart_id: orderId, amount: 24000 }),
      ])
      expect(again.status).toBe(200)
      expect(again.data.refund).toMatchObject({ amount: "240.00", made_before: true })
      expect(closed).toMatchObject({ status: "done", error_code: null })
      // One refund at PayTR, one in Medusa's record
      expect(fake.payments.get(reference)?.refunds).toEqual([
        { amount: 24000, referenceNo: "refund0000000031" },
      ])
      expect((payments[0] as { refunds: unknown[] }).refunds).toHaveLength(1)
    })

    it("leaves no payment naming a refund once a cancel's refunds are through", async () => {
      const { orderId, reference } = await paidOrder()
      // All given back already: the cancel's own refunds have nothing to name, or to clear
      await refund(orderId, { amount: 330, reference: "refund0000000034" })
      const payment = await paymentOf(orderId)
      // A name a crash left behind
      await getContainer()
        .resolve(Modules.PAYMENT)
        .updatePayment({
          id: payment?.id ?? "",
          data: {
            ...payment?.data,
            pending_refund: { reference_no: "refund0000000033", amount: 33000 },
          },
        } as never)

      const cancelled = await settle(
        http.post(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers })
      )

      expect(cancelled.status).toBe(200)
      expect((await paymentOf(orderId))?.data).not.toHaveProperty("pending_refund")
      // Nothing more given back: the one refund made before the cancel
      expect(fake.payments.get(reference)?.refunds).toEqual([
        { amount: 33000, referenceNo: "refund0000000034" },
      ])
    })
  },
})
