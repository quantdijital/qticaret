import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { ORDER_REFUNDS_MODULE } from "../../src/modules/order-refunds"
import type OrderRefundsModuleService from "../../src/modules/order-refunds/service"
import { keepMadePart } from "../../src/workflows/orders/made-in-part"
import { checkedNote } from "../../src/workflows/orders/made-refund-record"
import { ESCALATE_MS, settleOpenRefunds } from "../../src/workflows/orders/settle-open-refunds"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
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
const MINUTE = 60 * 1000
// iyzico's own refusal of one part: nothing done for it
const refused = {
  body: { status: "failure", errorCode: "99", errorMessage: "x", locale: "tr", systemTime: 0 },
}

/**
 * D4-1 (follow-up of PR #153): an iyzico refund made in part (one item
 * transaction's part answered done, the next refused) is closed by staff
 * at exactly what iyzico confirmed, read from the ledger; the rest is
 * refunded anew under a new key, never past what is left. A part whose
 * answer was lost stops it; only owner and admin may; one record only.
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

    /** Two cups (120 each) and shipping (90): 330 TL paid; iyzico's payment id. */
    const paidOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId, undefined, 2)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = fake.pay(started.token)
      await postIyzicoCallback(base(), started.sessionId, started.token, account.secretKey)
      return {
        orderId: (await orderOfCart(getContainer(), cartId)) ?? "",
        paymentId: form.result?.paymentId ?? "",
      }
    }
    const refund = (orderId: string, body: Record<string, unknown>, headers = admin.headers) =>
      refundOrder(http, headers, orderId, body)
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
    const sentFor = (reference: string) =>
      fake.requests.filter(
        ({ path, body }) => path === REFUND && body["conversationId"] === reference
      ).length
    /** Medusa's refunds of the refund's payment and the order's refund money moves. */
    const recordsOf = async (orderId: string, reference: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "payment",
          fields: ["refunds.amount", "refunds.note", "payment_collection.refunded_amount"],
          filters: { id: (await entryOf(reference)).payment_id },
        })
      const payment = data[0] as {
        refunds: { amount: unknown; note: string | null }[]
        payment_collection: { refunded_amount: unknown }
      }
      const moves = await getContainer()
        .resolve(Modules.ORDER)
        .listOrderTransactions({ order_id: orderId, reference: "refund" })
      return {
        refunds: payment.refunds.map(({ amount, note }) => ({ amount: Number(amount), note })),
        refunded: Number(payment.payment_collection.refunded_amount),
        moves: moves.map(({ amount }) => Number(amount)),
      }
    }
    /**
     * 300 TL of the 330 asked back: the cups' part (240) answered, the
     * shipping's part (60) refused by iyzico. The entry stays open, made in part.
     */
    const madeInPart = async (orderId: string, reference: string) => {
      fake.queue(REFUND, { pass: true })
      fake.queue(REFUND, refused)
      const halfway = await refund(orderId, { amount: 300, reference })
      expect(halfway.status).toBeGreaterThanOrEqual(400)
      const entry = await entryOf(reference)
      expect(entry).toMatchObject({ status: "pending", error_code: "refund_incomplete" })
      expect(entry.provider_parts).toEqual([
        expect.objectContaining({ amount: 24000, state: "done" }),
      ])
      return entry
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

    it("closes it at what iyzico made; the rest refunds anew, never past what is left", async () => {
      const { orderId, paymentId } = await paidOrder()
      const reference = "d0000000000000000000000000000001"
      const entry = await madeInPart(orderId, reference)
      // Open, the job keeps the shop told once it is old
      const before = await settleOpenRefunds(getContainer(), Date.now() + ESCALATE_MS + MINUTE)
      const alerts = await getContainer()
        .resolve(Modules.NOTIFICATION)
        .listNotifications({ trigger_type: "payments.refund_unresolved" }, { select: ["data"] })

      const checked = await check(orderId, reference)
      const after = await settleOpenRefunds(getContainer(), Date.now() + ESCALATE_MS + MINUTE)
      const closed = await entryOf(reference)
      const records = await recordsOf(orderId, reference)
      const details = await http.get<{ refunds: { reference: string; made_in_part: boolean }[] }>(
        `/admin/orders/${orderId}/payment-details`,
        { headers: admin.headers }
      )
      const [audit] = await eventually(
        async () =>
          (
            await getContainer().resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).listAuditEntries({
              resource_type: "order",
              resource_id: orderId,
              action: "POST /admin/orders/:id/refunds/:reference/settle",
            })
          ).filter((each) => each.outcome === 200),
        (entries) => entries.length > 0
      )

      expect(before).toMatchObject({ open: 1 })
      expect(alerts.map(({ data }) => data)).toEqual([
        expect.objectContaining({ issue: "refund_unresolved", reference }),
      ])
      expect(checked.status).toBe(200)
      expect(checked.data.refund).toMatchObject({ status: "done" })
      // Settled, the job reads it no more
      expect(after).toEqual({ closed: 0, failed: 0, open: 0 })
      expect(closed).toMatchObject({
        status: "done",
        error_code: "checked_made_in_part",
        amount: 24000,
        provider_parts: entry.provider_parts,
      })
      // Exactly what iyzico confirmed: one Medusa record, one money move
      expect(records).toEqual({
        refunds: [{ amount: 240, note: checkedNote(reference) }],
        refunded: 240,
        moves: [-240],
      })
      expect(details.data.refunds).toEqual([
        expect.objectContaining({ reference, made_in_part: true, amount: "240.00" }),
      ])
      // Who settled it, and what was made and left: 300 asked, 240 made
      expect(audit?.actor_id).toEqual(expect.stringMatching(/^user_/))
      expect(audit?.changes).toMatchObject({
        diff: {
          refund: {
            before: { status: "pending", amount: 30000, done: 24000 },
            after: { status: "done", error_code: "checked_made_in_part", amount: 24000 },
          },
        },
      })

      const over = await refund(orderId, {
        amount: 90.01,
        reference: "d0000000000000000000000000000003",
      })
      const rest = await refund(orderId, {
        amount: 60,
        reference: "d0000000000000000000000000000004",
      })
      const past = await refund(orderId, {
        amount: 30.01,
        reference: "d0000000000000000000000000000005",
      })

      // 330 paid, 240 back: 90 left at most
      expect(over.data.message).toBe("orders.refund_exceeds_paid")
      expect(rest.status).toBe(200)
      expect(rest.data.refund).toMatchObject({ amount: "60.00", made_before: false })
      expect(past.data.message).toBe("orders.refund_exceeds_paid")
      // The cups' part never sent twice; the rest went to the shipping's transaction
      expect(fake.refunds.get(`${paymentId}01`)).toEqual([24000])
      expect(fake.refunds.get(`${paymentId}02`)).toEqual([6000])
      expect(sentFor(reference)).toBe(2)
      expect((await recordsOf(orderId, reference)).refunded).toBe(300)
    })

    it("refuses while a part's answer was lost: it may have been made", async () => {
      const { orderId } = await paidOrder()
      const reference = "d0000000000000000000000000000011"
      fake.queue(REFUND, { pass: true })
      fake.queue(REFUND, { drop: true })
      await refund(orderId, { amount: 300, reference })

      const checked = await check(orderId, reference)
      const open = await entryOf(reference)

      expect(checked.status).toBe(409)
      expect(checked.data.message).toBe("orders.refund_check_part_unknown")
      expect(open).toMatchObject({ status: "pending", amount: 30000 })
      expect(open.provider_parts).toEqual([
        expect.objectContaining({ amount: 24000, state: "done" }),
        expect.objectContaining({ amount: 6000, state: "sending" }),
      ])
    })

    it("is for owner and admin only", async () => {
      const { orderId } = await paidOrder()
      const reference = "d0000000000000000000000000000021"
      await madeInPart(orderId, reference)
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

    it("writes one record with the job and a second check at once", async () => {
      const { orderId } = await paidOrder()
      const reference = "d0000000000000000000000000000031"
      await madeInPart(orderId, reference)

      const [first, round, second] = await Promise.all([
        check(orderId, reference),
        settleOpenRefunds(getContainer(), Date.now() + 3 * MINUTE),
        check(orderId, reference),
      ])
      const closed = await entryOf(reference)

      // One check wins; the other finds it closed, the job never closes it twice
      expect([first.status, second.status].sort()).toEqual([200, 400])
      expect([first.data.message, second.data.message]).toContain("orders.refund_not_open")
      expect(round.closed + round.failed).toBe(0)
      expect(closed).toMatchObject({ status: "done", amount: 24000 })
      expect(await recordsOf(orderId, reference)).toEqual({
        refunds: [{ amount: 240, note: checkedNote(reference) }],
        refunded: 240,
        moves: [-240],
      })
    })

    it("cut short after the entry was rewritten, the job closes it at the made part, sending nothing", async () => {
      const { orderId, paymentId } = await paidOrder()
      const reference = "d0000000000000000000000000000041"
      const entry = await madeInPart(orderId, reference)
      // The check's first write, as a crash leaves it: the entry at the made part, still open
      await keepMadePart(getContainer(), entry, 24000)

      const round = await settleOpenRefunds(getContainer(), Date.now() + 3 * MINUTE)
      const closed = await entryOf(reference)
      const records = await recordsOf(orderId, reference)
      const rest = await refund(orderId, {
        amount: 60,
        reference: "d0000000000000000000000000000042",
      })

      expect(round).toMatchObject({ closed: 1 })
      expect(closed).toMatchObject({ status: "done", amount: 24000 })
      expect(records.refunds.map(({ amount }) => amount)).toEqual([240])
      expect(records.moves).toEqual([-240])
      // Nothing more sent under the refund's reference: its two parts only
      expect(sentFor(reference)).toBe(2)
      expect(fake.refunds.get(`${paymentId}01`)).toEqual([24000])
      expect(rest.data.refund).toMatchObject({ amount: "60.00" })
    })
  },
})
