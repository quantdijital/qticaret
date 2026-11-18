import { fakeIyzicoAccount, fakeSecret, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { turkishDay } from "../../../dashboard"
import { kurus } from "../../../money"
import { createIyzicoApi } from "../client"
import type { IyzicoApi } from "../client"
import { readIyzicoStatement, statementAnswer } from "../statement"
import type { IyzicoCredentials } from "../types"

const account = fakeIyzicoAccount()
const credentials: IyzicoCredentials = { ...account, testMode: true }

/** A paid form as the fake keeps it, at `paidAt`. */
const paidForm = (n: number, paidAt: number) => ({
  token: `token-${String(n)}`,
  conversationId: `ses_${String(n)}`,
  basketId: `ses_${String(n)}`,
  price: "120.50",
  paidPrice: "120.50",
  currency: "TRY",
  callbackUrl: "https://magaza.example.com/donus",
  enabledInstallments: [1],
  items: [{ id: "item_1", price: "120.50" }],
  result: {
    paymentStatus: "SUCCESS" as const,
    paymentId: String(30_000_000 + n),
    fraudStatus: 1,
    installment: 1,
    paidPrice: "126.10",
    paidAt,
  },
})

describe("iyzico's daily transactions report", () => {
  it("reads payments as sales, refunds and cancels as refunds, and drops a rejected payment", () => {
    const { transactions } = statementAnswer.parse({
      transactions: [
        {
          transactionType: "PAYMENT",
          transactionStatus: 1,
          transactionDate: "2026-10-28 23:59:58",
          paymentId: 1001,
          price: 120.5,
        },
        {
          transactionType: "PAYMENT",
          transactionStatus: -1,
          transactionDate: "2026-10-28 10:00:00",
          paymentId: "1002",
          price: "80",
        },
        {
          transactionType: "REFUND",
          transactionDate: "2026-10-28 11:00:00",
          paymentId: "1003",
          price: "20.25",
        },
        {
          transactionType: "CANCEL",
          transactionDate: "2026-10-28 12:00:00",
          paymentId: "1004",
          price: 50,
        },
      ],
      totalPageCount: 1,
    })
    const rows = readIyzicoStatement(transactions)

    expect(rows).toEqual([
      { kind: "sale", reference: "1001", amount: kurus(12050), day: "2026-10-28" },
      { kind: "refund", reference: "1003", amount: kurus(2025), day: "2026-10-28" },
      { kind: "refund", reference: "1004", amount: kurus(5000), day: "2026-10-28" },
    ])
  })

  describe("against the fake server", () => {
    let fake: FakeIyzico
    let api: IyzicoApi

    beforeEach(async () => {
      fake = await startFakeIyzico(account)
      api = createIyzicoApi({
        sandboxUrl: fake.url,
        liveUrl: fake.url,
        // No case here is about the client timeout. At 500 ms a busy CI runner timed a
        // local answer out and the retry missed the answer a case had queued
        timeoutMs: 10_000,
        retry: { baseDelayMs: 1 },
        sleep: () => Promise.resolve(),
      })
    })

    afterEach(async () => {
      await fake.close()
    })

    it("reads every page of the day, a GET signed over its path", async () => {
      const now = Date.now()
      for (let n = 1; n <= 7; n += 1) {
        const form = paidForm(n, now)
        fake.forms.set(form.token, form)
      }
      fake.forms.set("old", paidForm(8, now - 3 * 24 * 60 * 60 * 1000))

      const rows = await api.statement(credentials, turkishDay(new Date(now)))
      const asked = fake.requests.filter((request) => request.path.includes("/reporting/"))

      expect(rows).toHaveLength(7)
      expect(rows[0]).toEqual({
        kind: "sale",
        reference: "30000001",
        amount: kurus(12050),
        day: turkishDay(new Date(now)),
      })
      // Five rows a page on the fake: two pages
      expect(asked).toHaveLength(2)
    })

    it("is refused under another secret key", async () => {
      const wrong = { ...credentials, secretKey: fakeSecret() }

      await expect(api.statement(wrong, "2026-10-28")).rejects.toMatchObject({
        providerCode: "signature_invalid",
      })
    })
  })
})
