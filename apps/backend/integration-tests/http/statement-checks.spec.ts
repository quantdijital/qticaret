import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  fakeIyzicoAccount,
  fakePaytrAccount,
  paytrNotification,
  startFakeIyzico,
  startFakePaytr,
} from "@qticaret/testing"
import type { FakeIyzico, FakePaytr } from "@qticaret/testing"
import { checkStatements } from "../../src/jobs/statement-checks"
import { turkishDay } from "../../src/lib/dashboard"
import type { StatementProvider } from "../../src/lib/payments/statements"
import { statementCheckWorkflow } from "../../src/workflows/payments/statement-check"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { connectIyzico, postIyzicoCallback, startIyzicoPayment } from "../helpers/iyzico"
import {
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

jest.setTimeout(180 * 1000)

const DAY_MS = 24 * 60 * 60 * 1000
// Made-up accounts, fresh per run; the fakes check every signature with them
const paytrAccount = fakePaytrAccount()
const iyzicoAccount = fakeIyzicoAccount()

/** F11.3 (adr/0039 §3): PayTR's and iyzico's statements against the shop's payments. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let paytr: FakePaytr
    let iyzico: FakeIyzico
    let shop: StockShop
    let storefront: Storefront
    let variantId: string
    let admin: { headers: Record<string, string> }

    /** A cup (120) and shipping (90), paid with PayTR: 210 TL. */
    const paytrOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const reference = await startPaytrPayment(http, storefront.headers, cartId)
      paytr.pay(reference)
      await notifyPaytr(
        http,
        paytrNotification(paytrAccount, {
          merchantOid: reference,
          status: "success",
          paymentAmount: 21000,
          testMode: true,
        })
      )
      const payment = paytr.payments.get(reference)
      if (payment) {
        payment.notified = true
      }
      return { reference, orderId: (await orderOfCart(getContainer(), cartId)) ?? "" }
    }
    const iyzicoOrder = async () => {
      const cartId = await readyCart(getContainer(), shop, variantId)
      const started = await startIyzicoPayment(http, storefront.headers, cartId)
      const form = iyzico.pay(started.token)
      await postIyzicoCallback(base(), started.sessionId, started.token, iyzicoAccount.secretKey)
      return {
        reference: form.result?.paymentId ?? "",
        orderId: (await orderOfCart(getContainer(), cartId)) ?? "",
      }
    }
    const check = async (provider: StatementProvider, day = turkishDay(new Date())) =>
      (await statementCheckWorkflow(getContainer()).run({ input: { provider, day } })).result
    const alerts = async () =>
      (
        await getContainer()
          .resolve(Modules.NOTIFICATION)
          .listNotifications({ channel: "feed" }, { select: ["data"] })
      ).flatMap(({ data }) =>
        data?.["kind"] === "statement_check"
          ? [{ provider: data["provider"], issues: data["issues"] }]
          : []
      )

    beforeAll(async () => {
      paytr = await startFakePaytr(paytrAccount)
      iyzico = await startFakeIyzico(iyzicoAccount)
      // Read on the first call of each client
      process.env["PAYTR_BASE_URL"] = paytr.url
      process.env["IYZICO_BASE_URL"] = iyzico.url
    })

    afterAll(async () => {
      delete process.env["PAYTR_BASE_URL"]
      delete process.env["IYZICO_BASE_URL"]
      await Promise.all([paytr.close(), iyzico.close()])
    })

    beforeEach(async () => {
      // Each test's shop starts empty: so do the providers' books
      paytr.payments.clear()
      paytr.refundLog.length = 0
      iyzico.forms.clear()
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      const cup = await stockedProduct(container, shop, `kupa-${String(Date.now())}`, 10, 120)
      variantId = cup.variantId
      admin = await connectPaytr(http, container, paytrAccount)
      await connectIyzico(http, container, iyzicoAccount)
    })

    it("agrees when each order's payment is on the statement, and lists the day for staff", async () => {
      await paytrOrder()
      await paytrOrder()
      await iyzicoOrder()

      const paytrCheck = await check("paytr")
      const iyzicoCheck = await check("iyzico")
      const listed = await http.get<{
        checks: { provider: string; status: string }[]
        providers: unknown[]
      }>("/admin/reports/statements?period=today", { headers: admin.headers })
      const anonymous = await settle(http.get("/admin/reports/statements?period=today"))

      expect(paytrCheck).toMatchObject({ status: "matched", matched: 2, sales: 2, issues: [] })
      expect(iyzicoCheck).toMatchObject({ status: "matched", matched: 1, sales: 1, issues: [] })
      expect(listed.data.checks.map(({ provider, status }) => `${provider} ${status}`)).toEqual([
        "iyzico matched",
        "paytr matched",
      ])
      expect(listed.data.providers).toEqual([
        { provider: "paytr", connected: true, test_mode: true },
        { provider: "iyzico", connected: true, test_mode: true },
      ])
      expect(anonymous.status).toBe(401)
      expect(await alerts()).toEqual([])
    })

    it("names what does not agree, with the order, and rings the bell once", async () => {
      const lost = await paytrOrder()
      const refunded = await paytrOrder()
      // PayTR booked the first a week ago, gave money back on the second
      // that the shop never did, and took money for no payment of the shop's
      const lostPayment = paytr.payments.get(lost.reference)
      if (lostPayment) {
        lostPayment.paidAt = Date.now() - 7 * DAY_MS
      }
      paytr.refundLog.push({ merchantOid: refunded.reference, amount: 5000, at: Date.now() })
      paytr.payments.set("QTSTRAY01", {
        merchantOid: "QTSTRAY01",
        paymentAmount: 9900,
        totalAmount: 9900,
        currency: "TL",
        testMode: true,
        installments: 1,
        status: "success",
        paidAt: Date.now(),
        notified: true,
        refunds: [],
        formToken: "stray",
        okUrl: "https://magaza.example.com/tamam",
        failUrl: "https://magaza.example.com/hata",
        maxInstallment: 0,
      })

      const result = await check("paytr")

      expect(result.status).toBe("mismatched")
      expect(result.matched).toBe(1)
      expect(result.issues).toHaveLength(3)
      expect(result.issues).toEqual(
        expect.arrayContaining([
          {
            kind: "missing_at_provider",
            reference: lost.reference,
            order_id: lost.orderId,
            display_id: expect.any(Number) as unknown,
            shop: 21000,
            provider: 0,
          },
          expect.objectContaining({
            kind: "refund_mismatch",
            reference: refunded.reference,
            order_id: refunded.orderId,
            shop: 0,
            provider: 5000,
          }),
          expect.objectContaining({
            kind: "unknown_at_shop",
            reference: "QTSTRAY01",
            order_id: null,
            provider: 9900,
          }),
        ])
      )
      expect(await alerts()).toEqual([{ provider: "paytr", issues: 3 }])
    })

    it("agrees on a refund made through the shop", async () => {
      const { orderId } = await paytrOrder()
      const refunded = await settle(
        http.post(
          `/admin/orders/${orderId}/refunds`,
          { amount: 50, reference: "refund0000000001" },
          { headers: admin.headers }
        )
      )

      const result = await check("paytr")

      expect(refunded.status).toBe(200)
      expect(paytr.refundLog).toHaveLength(1)
      expect(result).toMatchObject({ status: "matched", matched: 1, issues: [] })
    })

    it("checks live accounts each morning, and tries a day it could not read again", async () => {
      const container = getContainer()
      const testOnly = await checkStatements(container)
      await settle(
        http.post(
          "/admin/integrations/credentials/paytr",
          {
            settings: { merchant_id: paytrAccount.merchantId, test_mode: false },
            secrets: {
              merchant_key: paytrAccount.merchantKey,
              merchant_salt: paytrAccount.merchantSalt,
            },
          },
          { headers: admin.headers }
        )
      )
      paytr.queue("/rapor/islem-dokumu", { body: { status: "error", err_no: "099" } })
      const yesterday = turkishDay(new Date(Date.now() - DAY_MS))

      const first = await checkStatements(container)
      const failed = await http.get<{
        checks: { day: string; status: string; error_code: string }[]
      }>("/admin/reports/statements?period=7d", { headers: admin.headers })
      // The next morning: the new day, and the one that failed
      const next = await checkStatements(container, new Date(Date.now() + DAY_MS))
      const after = await http.get<{ checks: { day: string; status: string }[] }>(
        "/admin/reports/statements?period=7d",
        { headers: admin.headers }
      )

      expect(testOnly).toBe(0)
      expect(first).toBe(3)
      expect(failed.data.checks.find((entry) => entry.day === yesterday)).toMatchObject({
        status: "failed",
        error_code: "error_099",
      })
      expect(next).toBe(2)
      expect(after.data.checks.find((entry) => entry.day === yesterday)?.status).toBe("matched")
    })

    it("checks a closed day again on request, never today", async () => {
      const ask = (day: string) =>
        settle(
          http.post<{ check: { status: string } }>(
            "/admin/reports/statements",
            { provider: "iyzico", day },
            { headers: admin.headers }
          )
        )

      const today = await ask(turkishDay(new Date()))
      const yesterday = await ask(turkishDay(new Date(Date.now() - DAY_MS)))

      expect(today.status).toBe(400)
      expect(yesterday.status).toBe(200)
      expect(yesterday.data.check.status).toBe("matched")
    })
  },
})
