import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
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

interface MoneyLine {
  id: string
  kind: string
  refunded_units: number
  refunded_net: string
}

/** F5 V5: money back on an order, line by line, each refund made once. */
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
      // PayTR counts the payment acknowledged once the shop answered "OK"
      const payment = fake.payments.get(reference)
      if (payment) {
        payment.notified = true
      }
      return { orderId: (await orderOfCart(getContainer(), cartId)) ?? "", reference }
    }
    const lines = async (orderId: string) =>
      (
        await http.get<{ money: { lines: MoneyLine[]; refundable: string } }>(
          `/admin/orders/${orderId}/money`,
          { headers: admin.headers }
        )
      ).data.money
    const refund = (orderId: string, body: Record<string, unknown>) =>
      settle(
        http.post<{ refund: { amount: string; made_before: boolean }; message?: string }>(
          `/admin/orders/${orderId}/refunds`,
          body,
          { headers: admin.headers }
        )
      )

    beforeAll(async () => {
      fake = await startFakePaytr(account)
      // Read on the first PayTR call (lib/payments/paytr/client.ts)
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

    it("gives back a unit at what it paid, through PayTR, once per reference", async () => {
      const { orderId, reference } = await paidOrder()
      const item = (await lines(orderId)).lines.find((line) => line.kind === "item")
      const body = {
        items: [{ id: item?.id, quantity: 1 }],
        reference: "f0000000000000000000000000000001",
      }

      const preview = await settle(
        http.post<{ refund: { amount: string } }>(
          `/admin/orders/${orderId}/refunds/preview`,
          { items: body.items },
          { headers: admin.headers }
        )
      )
      const first = await refund(orderId, body)
      const again = await refund(orderId, body)

      expect(preview.data.refund.amount).toBe("120.00")
      expect(first.data.refund).toMatchObject({ amount: "120.00", made_before: false })
      expect(again.data.refund).toMatchObject({ amount: "120.00", made_before: true })
      expect(fake.payments.get(reference)?.refunds).toEqual([
        { amount: 12000, referenceNo: "f0000000000000000000000000000001" },
      ])
      expect((await lines(orderId)).lines.find((line) => line.id === item?.id)).toMatchObject({
        refunded_units: 1,
        refunded_net: "120.00",
      })
    })

    it("refuses units past the line and amounts past what was paid", async () => {
      const { orderId } = await paidOrder()
      const item = (await lines(orderId)).lines.find((line) => line.kind === "item")
      await refund(orderId, {
        items: [{ id: item?.id, quantity: 1 }],
        reference: "f0000000000000000000000000000002",
      })

      const units = await refund(orderId, {
        items: [{ id: item?.id, quantity: 2 }],
        reference: "f0000000000000000000000000000003",
      })
      const amount = await refund(orderId, {
        amount: 300,
        reference: "f0000000000000000000000000000004",
      })

      expect(units.data).toMatchObject({ message: "orders.refund_units_exceeded" })
      expect(amount.data).toMatchObject({ message: "orders.refund_exceeds_paid" })
    })

    it("lets a free amount lower what the lines give back later", async () => {
      const { orderId, reference } = await paidOrder()
      const item = (await lines(orderId)).lines.find((line) => line.kind === "item")

      const free = await refund(orderId, {
        amount: 50,
        reference: "f0000000000000000000000000000005",
      })
      const rest = await refund(orderId, {
        items: [{ id: item?.id, quantity: 2 }],
        shipping: true,
        reference: "f0000000000000000000000000000006",
      })

      expect(free.data.refund.amount).toBe("50.00")
      expect(rest.data.refund.amount).toBe("280.00")
      expect(fake.payments.get(reference)?.refunds.map(({ amount }) => amount)).toEqual([
        5000, 28000,
      ])
      expect((await lines(orderId)).refundable).toBe("0.00")
    })

    // PayTR answered and refused: nothing was made, the entry fails at once (review 2026-11-17)
    it("says why PayTR refused, keeps the ledger clean, and goes through when tried again", async () => {
      const { orderId, reference } = await paidOrder()
      fake.queue("/odeme/iade", {
        body: { status: "error", err_no: "010", err_msg: "Yetersiz bakiye" },
      })

      const refused = await refund(orderId, {
        amount: 30,
        reference: "f0000000000000000000000000000007",
      })
      const [entry] = await getContainer()
        .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
        .listOrderRefunds({ reference: "f0000000000000000000000000000007" })
      const again = await refund(orderId, {
        amount: 30,
        reference: "f0000000000000000000000000000007",
      })

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "paytr.balance_insufficient" })
      expect(entry).toMatchObject({ status: "failed", error_code: "refund_failed" })
      expect(again.data.refund).toMatchObject({ amount: "30.00", made_before: false })
      expect(fake.payments.get(reference)?.refunds).toHaveLength(1)
    })

    it("cancels an order by refunding what is left first; a refund that fails stops the cancel", async () => {
      const { orderId, reference } = await paidOrder()
      const status = async () => {
        const { data } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order", fields: ["status"], filters: { id: orderId } })
        return (data[0] as { status: string }).status
      }
      fake.queue("/odeme/iade", {
        body: { status: "error", err_no: "010", err_msg: "Yetersiz bakiye" },
      })

      const refused = await settle(
        http.post(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers })
      )
      const stillOpen = await status()
      const cancelled = await settle(
        http.post(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers })
      )

      expect(refused.data).toMatchObject({ message: "paytr.balance_insufficient" })
      expect(stillOpen).not.toBe("canceled")
      expect(cancelled.status).toBe(200)
      expect(await status()).toBe("canceled")
      // Ours refunded it all; Medusa's cancel found nothing left to refund
      expect(fake.payments.get(reference)?.refunds.map(({ amount }) => amount)).toEqual([33000])
    })

    it("closes Medusa's own payment refund to PayTR payments", async () => {
      const { orderId } = await paidOrder()
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["payment_collections.payments.id"],
          filters: { id: orderId },
        })
      const paymentId = (data[0] as { payment_collections: { payments: { id: string }[] }[] })
        .payment_collections[0]?.payments[0]?.id

      const refused = await settle(
        http.post(
          `/admin/payments/${paymentId ?? ""}/refund`,
          { amount: 10 },
          { headers: admin.headers }
        )
      )

      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "payments.use_order_refund" })
    })

    it("shows the shop PayTR's record of the payment, and the refunds made", async () => {
      const { orderId, reference } = await paidOrder()
      await refund(orderId, { amount: 30, reference: "f0000000000000000000000000000009" })

      const { data } = await http.get<{
        payments: Record<string, unknown>[]
        refunds: Record<string, unknown>[]
      }>(`/admin/orders/${orderId}/payment-details`, { headers: admin.headers })

      expect(data.payments).toEqual([
        expect.objectContaining({
          reference,
          available: true,
          test_mode: true,
          amount: "330.00",
          installments: 1,
          card_brand: "WORLD",
          card_last4: "6747",
          refunds: [
            expect.objectContaining({
              amount: "30.00",
              reference: "f0000000000000000000000000000009",
            }),
          ],
        }),
      ])
      expect(data.refunds).toEqual([
        expect.objectContaining({
          reference: "f0000000000000000000000000000009",
          amount: "30.00",
          status: "done",
        }),
      ])
      expect(JSON.stringify(data)).not.toMatch(/455359/)
    })
  },
})
