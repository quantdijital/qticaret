import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { cancelRefundReference } from "../../src/lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { CONFIRM_MS, settleOpenRefunds } from "../../src/workflows/orders/settle-open-refunds"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectPaytr } from "../helpers/paytr"
import { failLedgerCloseOnce, paidPaytrOrder, refundOrder } from "../helpers/refunds"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const account = fakePaytrAccount()
const key = () => randomUUID().replaceAll("-", "")
const MINUTE = 60 * 1000

/**
 * Security review 2026-11-17: a cancel tried again refunds each of an
 * order's payments once (Y1); the settling job closes a refund PayTR made
 * whose answer was lost, and fails one PayTR shows nothing of twice (O1/O2).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakePaytr
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    const paid = () =>
      paidPaytrOrder(http, getContainer(), { fake, account, shop, variantId, storefront })
    const refund = (orderId: string, body: Record<string, unknown>) =>
      refundOrder(http, admin.headers, orderId, body)
    const ledger = () => getContainer().resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const refundRequests = () => fake.requests.filter(({ path }) => path === "/odeme/iade")
    const payments = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: [
            "payment_collections.payments.id",
            "payment_collections.payments.provider_id",
            "payment_collections.payments.refunds.id",
          ],
          filters: { id: orderId },
        })
      const order = data[0] as {
        payment_collections: {
          payments: { id: string; provider_id: string; refunds: unknown[] }[]
        }[]
      }
      // PayTR's first, as a cancel refunds them
      return order.payment_collections
        .flatMap((collection) => collection.payments)
        .sort(
          (a, b) =>
            Number(b.provider_id === "pp_paytr_paytr") - Number(a.provider_id === "pp_paytr_paytr")
        )
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
      variantId = (await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120))
        .variantId
      admin = await connectPaytr(http, container, account)
      fake.requests.length = 0
    })

    it("refunds both payments of an order once when its cancel is tried again (Y1)", async () => {
      const { orderId, reference } = await paid()
      const { data: money } = await http.get<{ money: { lines: { id: string; kind: string }[] } }>(
        `/admin/orders/${orderId}/money`,
        { headers: admin.headers }
      )
      const cup = money.money.lines.find((line) => line.kind === "item")?.id
      // A third cup, its 120 TL collected by hand: a second payment
      const edited = await settle(
        http.post<{ difference?: string }>(
          `/admin/orders/${orderId}/edit`,
          {
            items: [{ id: cup, quantity: 3 }],
            expected_difference: 120,
            difference_collected: true,
            reference: key(),
          },
          { headers: admin.headers }
        )
      )
      const [first, second] = await payments(orderId)
      // The first payment's refund goes through, its entry cannot be closed
      const broken = failLedgerCloseOnce(ledger())
      const failed = await settle(
        http.post(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers })
      )
      broken.restore()
      const cancelled = await settle(
        http.post(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers })
      )
      const entries = await ledger().listOrderRefunds({ order_id: orderId })
      const transactions = await getContainer()
        .resolve(Modules.ORDER)
        .listOrderTransactions({ order_id: orderId, reference: "refund" })

      expect(edited.data.difference).toBe("120.00")
      expect(failed.status).toBeGreaterThanOrEqual(400)
      expect(cancelled.status).toBe(200)
      expect(fake.payments.get(reference)?.refunds).toEqual([
        { amount: 33000, referenceNo: cancelRefundReference(first?.id ?? "") },
      ])
      expect(
        entries.map(({ reference: ref, payment_id, amount, status }) => [
          ref,
          payment_id,
          amount,
          status,
        ])
      ).toEqual(
        expect.arrayContaining([
          [cancelRefundReference(first?.id ?? ""), first?.id, 33000, "done"],
          [cancelRefundReference(second?.id ?? ""), second?.id, 12000, "done"],
        ])
      )
      expect(entries).toHaveLength(2)
      expect((await payments(orderId)).map(({ refunds }) => refunds.length)).toEqual([1, 1])
      // Each refund's money move written once (review D1)
      expect(transactions).toHaveLength(2)
    })

    it("closes a refund whose answer was lost once PayTR shows it, sending nothing (O2)", async () => {
      const { orderId, reference } = await paid()
      const body = { amount: 30, reference: key() }
      fake.queue("/odeme/iade", { drop: true })

      const lost = await refund(orderId, body)
      const [unconfirmed] = await ledger().listOrderRefunds({ reference: body.reference })
      // PayTR made it after all; its record shows it a little later
      fake.payments.get(reference)?.refunds.push({ amount: 3000, referenceNo: body.reference })
      const round = await settleOpenRefunds(getContainer(), Date.now() + 3 * MINUTE)
      const [closed] = await ledger().listOrderRefunds({ reference: body.reference })

      expect(lost.status).toBeGreaterThanOrEqual(400)
      expect(unconfirmed).toMatchObject({ status: "pending", error_code: "refund_unconfirmed" })
      expect(round).toEqual({ closed: 1, failed: 0, open: 0 })
      expect(closed).toMatchObject({ status: "done", error_code: null })
      // The lost request alone: the job sent nothing
      expect(refundRequests()).toHaveLength(1)
      expect((await payments(orderId))[0]?.refunds).toHaveLength(1)
    })

    it("fails a refund PayTR shows nothing of twice, its amount free again (O2)", async () => {
      const { orderId, reference } = await paid()
      const body = { amount: 30, reference: key() }
      fake.queue("/odeme/iade", {
        body: { status: "error", err_no: "010", err_msg: "Yetersiz bakiye" },
      })

      await refund(orderId, body)
      const soon = await settleOpenRefunds(getContainer(), Date.now() + 3 * MINUTE)
      const [waiting] = await ledger().listOrderRefunds({ reference: body.reference })
      const later = await settleOpenRefunds(getContainer(), Date.now() + CONFIRM_MS + 3 * MINUTE)
      const [failed] = await ledger().listOrderRefunds({ reference: body.reference })
      const anew = await refund(orderId, { amount: 300, reference: key() })

      expect(soon).toEqual({ closed: 0, failed: 0, open: 1 })
      expect(waiting).toMatchObject({ status: "pending", error_code: "refund_unconfirmed" })
      expect(later).toEqual({ closed: 0, failed: 1, open: 0 })
      expect(failed).toMatchObject({ status: "failed", error_code: "refund_failed" })
      // The 30 TL is free again: 300 of 330 goes through
      expect(anew.data.refund).toMatchObject({ amount: "300.00", made_before: false })
      expect(fake.payments.get(reference)?.refunds.map(({ amount }) => amount)).toEqual([30000])
    })
  },
})
