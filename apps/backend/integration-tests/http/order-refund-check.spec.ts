import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakePaytrAccount, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { STRANDED_MS, settleOpenRefunds } from "../../src/workflows/orders/settle-open-refunds"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectPaytr } from "../helpers/paytr"
import { paidPaytrOrder, refundOrder } from "../helpers/refunds"
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
 * Security review 2026-11-17, second round: an open refund is never sent
 * again under its reference (O1); one a crash left unmarked is read by the
 * settling job, and staff settle what they checked at the provider (O2).
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
    const check = (orderId: string, reference: string, outcome: string) =>
      settle(
        http.post<{ refund?: { status: string }; message?: string }>(
          `/admin/orders/${orderId}/refunds/${reference}/settle`,
          { outcome },
          { headers: admin.headers }
        )
      )
    const cupOf = async (orderId: string) => {
      const { data } = await http.get<{ money: { lines: { id: string; kind: string }[] } }>(
        `/admin/orders/${orderId}/money`,
        { headers: admin.headers }
      )
      return data.money.lines.find((line) => line.kind === "item")?.id
    }
    /** A refund whose answer was lost: its entry waits unconfirmed. */
    const lostRefund = async (orderId: string, body: Record<string, unknown>) => {
      fake.queue("/odeme/iade", { drop: true })
      await refund(orderId, body)
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

    it("never sends a cancel's unconfirmed refund again when the cancel is tried again (O1)", async () => {
      const { orderId } = await paid()
      fake.queue("/odeme/iade", { drop: true })

      const lost = await settle(
        http.post(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers })
      )
      const again = await settle(
        http.post<{ message?: string }>(
          `/admin/orders/${orderId}/cancel`,
          {},
          {
            headers: admin.headers,
          }
        )
      )
      const entries = await ledger().listOrderRefunds({ order_id: orderId })

      expect(lost.status).toBeGreaterThanOrEqual(400)
      expect(again.status).toBe(409)
      expect(again.data.message).toBe("orders.refund_unsettled")
      expect(entries).toEqual([
        expect.objectContaining({ status: "pending", error_code: "refund_unconfirmed" }),
      ])
      // The lost request alone reached PayTR
      expect(refundRequests()).toHaveLength(1)
    })

    it("reads an entry a crash left pending unmarked, and marks it for the shop (O2)", async () => {
      const { orderId } = await paid()
      const body = { amount: 30, reference: key() }
      await lostRefund(orderId, body)
      const [entry] = await ledger().listOrderRefunds({ reference: body.reference })
      // As a crash leaves it: pending, nothing written about what became of it
      await ledger().updateOrderRefunds({ id: entry?.id ?? "", error_code: null })

      const early = await settleOpenRefunds(getContainer(), Date.now() + 3 * MINUTE)
      const late = await settleOpenRefunds(getContainer(), Date.now() + STRANDED_MS + MINUTE)
      const [marked] = await ledger().listOrderRefunds({ reference: body.reference })

      expect(early).toEqual({ closed: 0, failed: 0, open: 0 })
      expect(late).toEqual({ closed: 0, failed: 0, open: 1 })
      expect(marked).toMatchObject({ status: "pending", error_code: "refund_unconfirmed" })
    })

    it("lets staff fail a refund they saw was not made: its units refund again (O2)", async () => {
      const { orderId, reference } = await paid()
      const cup = await cupOf(orderId)
      const body = { items: [{ id: cup, quantity: 2 }], reference: key() }
      await lostRefund(orderId, body)

      const blocked = await refund(orderId, { ...body, reference: key() })
      const checked = await check(orderId, body.reference, "not_made")
      const anew = await refund(orderId, { ...body, reference: key() })

      expect(blocked.data.message).toBe("orders.refund_units_exceeded")
      expect(checked.data.refund).toMatchObject({ status: "failed" })
      expect(anew.data.refund).toMatchObject({ amount: "240.00", made_before: false })
      expect(fake.payments.get(reference)?.refunds.map(({ amount }) => amount)).toEqual([24000])
    })

    it("lets staff close a refund they saw made: Medusa's record and one money move (O2)", async () => {
      const { orderId, reference } = await paid()
      const body = { amount: 30, reference: key() }
      await lostRefund(orderId, body)
      // PayTR made it after all
      fake.payments.get(reference)?.refunds.push({ amount: 3000, referenceNo: body.reference })

      const checked = await check(orderId, body.reference, "made")
      const again = await check(orderId, body.reference, "made")
      const [closed] = await ledger().listOrderRefunds({ reference: body.reference })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "payment",
          fields: ["refunds.id", "payment_collection.refunded_amount"],
          filters: { id: closed?.payment_id },
        })
      const payment = data[0] as {
        refunds: unknown[]
        payment_collection: { refunded_amount: unknown }
      }
      const transactions = await getContainer()
        .resolve(Modules.ORDER)
        .listOrderTransactions({ order_id: orderId, reference: "refund" })

      expect(checked.data.refund).toMatchObject({ status: "done" })
      expect(again.data.message).toBe("orders.refund_not_open")
      expect(closed).toMatchObject({ status: "done", error_code: "checked_made" })
      expect(payment.refunds).toHaveLength(1)
      // The collection's refunded total kept as Medusa's own refund keeps it (D-2)
      expect(Number(payment.payment_collection.refunded_amount)).toBe(30)
      expect(transactions).toHaveLength(1)
      // Nothing more sent: the one lost request
      expect(refundRequests()).toHaveLength(1)
    })

    it("refuses not made for a refund PayTR shows made (D-1)", async () => {
      const { orderId, reference } = await paid()
      const body = { amount: 30, reference: key() }
      await lostRefund(orderId, body)
      fake.payments.get(reference)?.refunds.push({ amount: 3000, referenceNo: body.reference })

      const checked = await check(orderId, body.reference, "not_made")
      const [open] = await ledger().listOrderRefunds({ reference: body.reference })

      expect(checked.status).toBe(409)
      expect(checked.data.message).toBe("orders.refund_check_shown")
      expect(open).toMatchObject({ status: "pending" })
    })

    it("keeps a refund whose answer PayTR sent but did not read open, never failed (O-1)", async () => {
      const { orderId, reference } = await paid()
      const body = { amount: 30, reference: key() }
      // A 2xx PayTR answer of a shape not its own: unread, never a refusal
      fake.queue("/odeme/iade", { body: { status: "success" } })

      const unread = await refund(orderId, body)
      const [open] = await ledger().listOrderRefunds({ reference: body.reference })

      expect(unread.status).toBeGreaterThanOrEqual(400)
      expect(open).toMatchObject({ status: "pending", error_code: "refund_unconfirmed" })
      expect(fake.payments.get(reference)?.refunds).toEqual([])
    })

    it("finishes a staff check cut short after Medusa's record: one record, never two (fifth round)", async () => {
      const { orderId, reference } = await paid()
      const body = { amount: 30, reference: key() }
      await lostRefund(orderId, body)
      fake.payments.get(reference)?.refunds.push({ amount: 3000, referenceNo: body.reference })
      const module = getContainer().resolve(Modules.PAYMENT) as unknown as {
        createRefunds: (...args: unknown[]) => Promise<unknown>
        updatePayment: (...args: unknown[]) => Promise<unknown>
      }
      const created = jest.spyOn(module, "createRefunds")
      // Medusa's record is written, the payment's data is not
      const broken = jest
        .spyOn(module, "updatePayment")
        .mockRejectedValueOnce(new Error("database gone"))

      const cut = await check(orderId, body.reference, "made")
      broken.mockRestore()
      const round = await settleOpenRefunds(getContainer(), Date.now() + 3 * MINUTE)
      created.mockRestore()
      const [closed] = await ledger().listOrderRefunds({ reference: body.reference })
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "payment", fields: ["refunds.id"], filters: { id: closed?.payment_id } })
      const transactions = await getContainer()
        .resolve(Modules.ORDER)
        .listOrderTransactions({ order_id: orderId, reference: "refund" })

      expect(cut.status).toBeGreaterThanOrEqual(400)
      expect(round).toMatchObject({ closed: 1 })
      expect(closed).toMatchObject({ status: "done" })
      expect(created).toHaveBeenCalledTimes(1)
      expect((data[0] as { refunds: unknown[] }).refunds).toHaveLength(1)
      expect(transactions).toHaveLength(1)
      expect(refundRequests()).toHaveLength(1)
    })
  },
})
