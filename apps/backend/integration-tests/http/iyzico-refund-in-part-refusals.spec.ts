import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectIyzico, postIyzicoCallback, startIyzicoPayment } from "../helpers/iyzico"
import { orderOfCart, readyCart } from "../helpers/paytr"
import { defined, refundOrder } from "../helpers/refunds"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const account = fakeIyzicoAccount()
const REFUND = "/payment/refund"
const failure = (errorCode: string) => ({
  body: { status: "failure", errorCode, errorMessage: "x", locale: "tr", systemTime: 0 },
})

/**
 * D4-1 (follow-up of PR #153), security review: what closing an iyzico
 * refund in part refuses. A part whose answer was lost, or that iyzico
 * refused with a code not known to make nothing (S2), may have been made;
 * a cancel's or a return's refund is its flow's (S1); and only owner and
 * admin may close one.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let fake: FakeIyzico
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** Two cups (120 each) and shipping (90): 330 TL paid with iyzico. */
    const paidOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId, undefined, 2)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      fake.pay(started.token)
      await postIyzicoCallback(base(), started.sessionId, started.token, account.secretKey)
      return (await orderOfCart(getContainer(), cartId)) ?? ""
    }
    const refund = (orderId: string, body: Record<string, unknown>) =>
      refundOrder(http, admin.headers, orderId, body)
    const check = (orderId: string, reference: string, headers = admin.headers) =>
      settle(
        http.post<{ refund?: { status: string }; message?: string }>(
          `/admin/orders/${orderId}/refunds/${reference}/settle`,
          { outcome: "made_in_part" },
          { headers }
        )
      )
    const ledger = () => getContainer().resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    const entryOf = async (reference: string) =>
      defined((await ledger().listOrderRefunds({ reference }))[0], "ledger entry")
    /** The cups' part (240) answered, the shipping's then answered as `second`. */
    const halfway = (second: Parameters<FakeIyzico["queue"]>[1]) => {
      fake.queue(REFUND, { pass: true })
      fake.queue(REFUND, second)
    }

    beforeAll(async () => {
      fake = await startFakeIyzico(account)
      process.env["IYZICO_BASE_URL"] = fake.url
    })

    afterAll(async () => {
      delete process.env["IYZICO_BASE_URL"]
      await fake.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await connectIyzico(http, container, account)
    })

    it.each([
      ["whose answer was lost", { drop: true as const }],
      // iyzico keeps no refund list to read back: an unknown refusal may hide a part made (S2)
      ["refused with a code not known to make nothing", failure("10051")],
    ])("refuses while a part %s: it may have been made", async (_, second) => {
      const orderId = await paidOrder()
      const reference = "c0000000000000000000000000000001"
      halfway(second)
      const sent = await refund(orderId, { amount: 300, reference })

      const checked = await check(orderId, reference)
      const open = await entryOf(reference)

      expect(sent.data.message).toBe("iyzico.refund_outcome_unknown")
      expect(checked.status).toBe(409)
      expect(checked.data.message).toBe("orders.refund_check_part_unknown")
      expect(open).toMatchObject({ status: "pending", amount: 30000 })
      expect(open.provider_parts).toEqual([
        expect.objectContaining({ amount: 24000, state: "done" }),
        expect.objectContaining({ amount: 6000, state: "sending" }),
      ])
    })

    it("leaves a cancel's refund made in part to the cancel (S1)", async () => {
      const orderId = await paidOrder()
      // The whole payment back by item transaction: the shipping's part refused (5093)
      halfway(failure("5093"))
      const cancelled = await settle(
        http.post(`/admin/orders/${orderId}/cancel`, {}, { headers: admin.headers })
      )
      const [entry] = await ledger().listOrderRefunds({ order_id: orderId })
      const reference = defined(entry, "cancel's ledger entry").reference

      const checked = await check(orderId, reference)
      const open = await entryOf(reference)

      expect(cancelled.status).toBeGreaterThanOrEqual(400)
      expect(reference).toMatch(/^cancel/)
      expect(open.provider_parts).toEqual([
        expect.objectContaining({ amount: 24000, state: "done" }),
      ])
      expect(checked.status).toBe(409)
      expect(checked.data.message).toBe("orders.refund_in_part_flow_owned")
      expect(open).toMatchObject({ status: "pending", amount: 33000 })
    })

    it("leaves a return's refund made in part to the return (S1)", async () => {
      const orderId = await paidOrder()
      const panelKey = "c0000000000000000000000000000002"
      halfway(failure("5093"))
      await refund(orderId, { amount: 300, reference: panelKey })
      // Under the reference a return's refund is made with (`return<request id>`)
      const reference = "returnrreq01JTESTRETURNREFUNDINPART"
      await ledger().updateOrderRefunds({ id: (await entryOf(panelKey)).id, reference })

      const checked = await check(orderId, reference)
      const open = await entryOf(reference)

      expect(checked.status).toBe(409)
      expect(checked.data.message).toBe("orders.refund_in_part_flow_owned")
      expect(open).toMatchObject({ status: "pending", amount: 30000 })
    })

    it("is for owner and admin only", async () => {
      const orderId = await paidOrder()
      const reference = "c0000000000000000000000000000003"
      halfway(failure("5093"))
      await refund(orderId, { amount: 300, reference })
      const container = getContainer()
      const operations = await createAdminUser(http, container, "operations")
      const readonly = await createAdminUser(http, container, "readonly")
      const shopAdmin = await createAdminUser(http, container, "admin")

      const denied = [
        await check(orderId, reference, operations.headers),
        await check(orderId, reference, readonly.headers),
      ]
      const untouched = await entryOf(reference)
      const allowed = await check(orderId, reference, shopAdmin.headers)

      expect(denied.map(({ status }) => status)).toEqual([403, 403])
      expect(untouched).toMatchObject({ status: "pending", amount: 30000 })
      expect(allowed.data.refund).toMatchObject({ status: "done" })
    })
  },
})
