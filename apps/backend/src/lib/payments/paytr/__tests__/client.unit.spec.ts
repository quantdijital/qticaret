import { anyOf, fakePaytrAccount, fakeSecret, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { isProviderError } from "../../../errors"
import { kurus } from "../../../money"
import { createPaytrApi } from "../client"
import type { PaytrApi } from "../client"
import type { PaytrCredentials, PaytrTokenRequest } from "../types"

// A made-up account, fresh per run; the fake server checks every signature with it
const account = fakePaytrAccount()
const credentials: PaytrCredentials = { ...account, testMode: true }

const tokenRequest = (merchantOid: string): PaytrTokenRequest => ({
  merchantOid,
  userIp: "85.105.10.20",
  email: "ayse.yilmaz@example.com",
  amount: kurus(3456),
  currencyCode: "try",
  basket: [
    { name: "Seramik kupa", price: kurus(1200), quantity: 2 },
    { name: "Kargo", price: kurus(1056), quantity: 1 },
  ],
  maxInstallment: 0,
  noInstallment: false,
  userName: "Ayşe Yılmaz",
  userAddress: "Atatürk Cad. No: 1 Kadıköy İstanbul",
  userPhone: "05320000000",
  okUrl: "https://magaza.example.com/odeme/tamam",
  failUrl: "https://magaza.example.com/odeme/hata",
})

const codeOf = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run
  } catch (error) {
    return isProviderError(error) ? error.providerCode : String(error)
  }
  return "no error"
}

describe("PayTR client against the fake server", () => {
  let fake: FakePaytr
  let api: PaytrApi

  beforeEach(async () => {
    fake = await startFakePaytr(account)
    api = createPaytrApi({
      baseUrl: fake.url,
      timeoutMs: 500,
      retry: { baseDelayMs: 1 },
      sleep: () => Promise.resolve(),
    })
  })

  afterEach(async () => {
    await fake.close()
  })

  it("gets an iFrame token; the key and salt never leave", async () => {
    const token = await api.requestToken(credentials, tokenRequest("SIP001"))

    expect(token).toMatch(/^[0-9a-f]+$/)
    const [sent] = fake.requests
    expect(sent?.fields).toMatchObject({
      merchant_id: "100001",
      payment_amount: "3456",
      currency: "TL",
      test_mode: "1",
      debug_on: "1",
      no_installment: "0",
    })
    expect(JSON.stringify(fake.requests)).not.toMatch(
      anyOf(account.merchantKey, account.merchantSalt)
    )
    const basket: unknown = JSON.parse(
      Buffer.from(sent?.fields["user_basket"] ?? "", "base64").toString("utf8")
    )
    expect(basket).toEqual([
      ["Seramik kupa", "12.00", 2],
      ["Kargo", "10.56", 1],
    ])
  })

  it("names the refused field when PayTR turns the token request down", async () => {
    const wrong = { ...credentials, merchantId: "999999" }

    expect(await codeOf(api.requestToken(wrong, tokenRequest("SIP001")))).toBe(
      "token_refused_merchant_id"
    )
    expect(
      await codeOf(
        api.requestToken({ ...credentials, merchantSalt: fakeSecret() }, tokenRequest("SIP002"))
      )
    ).toBe("token_refused")
  })

  it("refuses a merchant_oid PayTR would reject before sending anything", async () => {
    await expect(api.requestToken(credentials, tokenRequest("ses_01J"))).rejects.toThrow(RangeError)
    expect(fake.requests).toHaveLength(0)
  })

  it("reads a paid order from the status query: comma amounts, last four digits only", async () => {
    await api.requestToken(credentials, tokenRequest("SIP003"))
    fake.pay("SIP003", { installments: 3, totalAmount: 3600 })

    const status = await api.queryStatus(credentials, "SIP003")

    expect(status).toEqual({
      paymentAmount: 3456,
      totalAmount: 3600,
      currencyCode: "try",
      installments: 3,
      cardBrand: "WORLD",
      cardLast4: "6747",
      paymentType: "KART",
      testMode: true,
      refunds: [],
    })
  })

  it("answers null for an order with no successful payment (004)", async () => {
    expect(await api.queryStatus(credentials, "NOSUCHORDER")).toBeNull()
  })

  it("tells a wrong shop number from a wrong key or salt", async () => {
    expect(await api.checkCredentials(credentials)).toBe("valid")
    expect(await api.checkCredentials({ ...credentials, merchantId: "999999" })).toBe(
      "merchant_invalid"
    )
    expect(await api.checkCredentials({ ...credentials, merchantKey: fakeSecret() })).toBe(
      "secret_invalid"
    )
    expect(await api.checkCredentials({ ...credentials, merchantSalt: fakeSecret() })).toBe(
      "secret_invalid"
    )
  })

  it("asks the status query again after a gateway error: it is a read", async () => {
    fake.queue("/odeme/durum-sorgu", { status: 502, body: "bad gateway" })

    expect(await api.queryStatus(credentials, "NOSUCHORDER")).toBeNull()
    expect(fake.requests.filter((request) => request.path === "/odeme/durum-sorgu")).toHaveLength(2)
  })

  describe("refunds", () => {
    async function paidOrder(merchantOid: string, notified = true) {
      await api.requestToken(credentials, tokenRequest(merchantOid))
      fake.pay(merchantOid)
      const payment = fake.payments.get(merchantOid)
      if (payment) {
        payment.notified = notified
      }
    }

    it("refunds part of a payment and finds it again by its reference", async () => {
      await paidOrder("SIP010")

      const refund = await api.refund(credentials, {
        merchantOid: "SIP010",
        amount: kurus(1197),
        referenceNo: "refund01",
      })
      const status = await api.queryStatus(credentials, "SIP010")

      expect(refund).toEqual({ amount: 1197, referenceNo: "refund01", testMode: true })
      expect(status?.refunds).toEqual([
        { amount: 1197, date: expect.any(String) as string, referenceNo: "refund01" },
      ])
      expect(fake.requests.at(-2)?.fields["return_amount"]).toBe("11.97")
    })

    it("maps PayTR's refusals to the platform's codes", async () => {
      await paidOrder("SIP011")
      await paidOrder("SIP012", false)
      const refund = (merchantOid: string, amount: number) =>
        codeOf(api.refund(credentials, { merchantOid, amount: kurus(amount), referenceNo: "r1" }))

      expect(await refund("SIP011", 5000)).toBe("refund_exceeds_payment")
      expect(await refund("SIP012", 100)).toBe("payment_not_notified")
      expect(await refund("NOSUCH", 100)).toBe("payment_not_found")
    })

    it("does not send a refund again after a gateway error: the outcome is unknown", async () => {
      await paidOrder("SIP014")
      fake.queue("/odeme/iade", { status: 502, body: "bad gateway" })

      const code = await codeOf(
        api.refund(credentials, { merchantOid: "SIP014", amount: kurus(100), referenceNo: "r3" })
      )

      expect(code).toBe("outcome_unknown")
      expect(fake.requests.filter((request) => request.path === "/odeme/iade")).toHaveLength(1)
    })

    it("marks a refund refused while PayTR pays the shop out as worth trying later", async () => {
      await paidOrder("SIP015")
      fake.queue("/odeme/iade", { body: { status: "error", err_no: "000", err_msg: "kilitli" } })

      const error = await api
        .refund(credentials, { merchantOid: "SIP015", amount: kurus(100), referenceNo: "r4" })
        .catch((failure: unknown) => failure)

      expect(error).toMatchObject({ providerCode: "refund_locked", retryable: true })
    })

    it("does not send a refund twice when the answer is lost", async () => {
      await paidOrder("SIP013")
      fake.queue("/odeme/iade", { hang: true })

      const code = await codeOf(
        api.refund(credentials, { merchantOid: "SIP013", amount: kurus(100), referenceNo: "r2" })
      )

      expect(code).toBe("outcome_unknown")
      expect(fake.requests.filter((request) => request.path === "/odeme/iade")).toHaveLength(1)
    })
  })

  it("reads installment rates per card family and count", async () => {
    const rates = await api.installmentRates(credentials)

    expect(rates.maxInstallment).toBe(12)
    expect(rates.rates["world"]).toEqual({ 2: 3.49, 3: 4.69, 6: 8.29, 12: 15.9 })
    expect(rates.rates["axess"]).toEqual({ 2: 3.59 })
  })

  it("reads a whole-lira amount written without decimals", async () => {
    await api.requestToken(credentials, tokenRequest("SIP004"))
    fake.pay("SIP004", { totalAmount: 3600 })

    expect((await api.queryStatus(credentials, "SIP004"))?.totalAmount).toBe(3600)
  })

  it("turns an amount in an undocumented form into an invalid answer, not a crash", async () => {
    fake.queue("/odeme/durum-sorgu", {
      body: {
        status: "success",
        payment_amount: "1.234,56",
        payment_total: "1.234,56",
        currency: "TL",
      },
    })

    expect(await codeOf(api.queryStatus(credentials, "SIP098"))).toBe("invalid_response")
  })

  it("does not resend a token request after a server error", async () => {
    fake.queue("/odeme/api/get-token", { status: 500, body: "error" })

    expect(await codeOf(api.requestToken(credentials, tokenRequest("SIP005")))).toBe(
      "outcome_unknown"
    )
    expect(fake.requests).toHaveLength(1)
  })

  it("gives up a check when the caller stops waiting", async () => {
    fake.queue("/odeme/durum-sorgu", { hang: true })
    const waiting = new AbortController()
    const check = api.checkCredentials(credentials, { signal: waiting.signal })
    waiting.abort()

    expect(await codeOf(check)).toBe("aborted")
  })

  it("treats an answer outside the documented shape as invalid", async () => {
    fake.queue("/odeme/durum-sorgu", { body: { status: "success" } })

    expect(await codeOf(api.queryStatus(credentials, "SIP099"))).toBe("invalid_response")
  })
})
