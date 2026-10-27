import { fakeIyzicoAccount, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { kurus } from "../../../money"
import { isProviderError } from "../../../errors"
import type { HostedCheckout } from "../../checkout"
import { parseIyzicoPrice, toIyzicoPrice } from "../amounts"
import { checkoutFormRequest, iyzicoPhone } from "../checkout-form"
import type { CheckoutFormInput } from "../checkout-form"
import { createIyzicoApi } from "../client"
import type { IyzicoApi } from "../client"

const account = fakeIyzicoAccount()
const credentials = { ...account, testMode: true }
const RETRIEVE = "/payment/iyzipos/checkoutform/auth/ecom/detail"
const SESSION = "payses_01K8ZB2X9Q6J4V7W3N5R0T1Y2Z"

const checkout: HostedCheckout = {
  email: "ayse.yilmaz@example.com",
  buyer: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    phone: "0532 000 00 00",
    address_1: "Atatürk Cad. No: 1",
    city: "Kadıköy",
    province: "İstanbul",
    postal_code: "34710",
    country_code: "tr",
  },
  ip: "85.34.78.112",
  return_urls: {
    success: "http://localhost:8000/odeme/tamam",
    failure: "http://localhost:8000/odeme/hata",
  },
  basket: [
    { id: "cali_1", kind: "item", name: "Kupa", quantity: 2, amount: 24000 },
    { id: "shipping", kind: "shipping", name: "Kargo", quantity: 1, amount: 9050 },
  ],
}

const input = (over: Partial<CheckoutFormInput> = {}): CheckoutFormInput => ({
  sessionId: SESSION,
  amount: kurus(33050),
  currencyCode: "try",
  checkout,
  callbackUrl: `http://localhost:9000/hooks/iyzico/callback?session=${SESSION}`,
  installments: { enabled: true, max: 6 },
  ...over,
})

describe("iyzico amounts", () => {
  it("writes kuruş as lira with two decimals and reads an answer's number back", () => {
    expect(toIyzicoPrice(kurus(33050))).toBe("330.50")
    expect(toIyzicoPrice(kurus(5))).toBe("0.05")
    expect(parseIyzicoPrice(330.5)).toBe(33050)
    expect(parseIyzicoPrice("10.0")).toBe(1000)
    expect(() => parseIyzicoPrice("1,5")).toThrow(RangeError)
    expect(() => parseIyzicoPrice(1.005)).toThrow(RangeError)
  })
})

describe("checkoutFormRequest", () => {
  it("builds the form from our checkout: our session as conversation and basket, items adding up", () => {
    const request = checkoutFormRequest(input())

    expect(request).toMatchObject({
      conversationId: SESSION,
      basketId: SESSION,
      price: "330.50",
      paidPrice: "330.50",
      currency: "TRY",
      enabledInstallments: [1, 2, 3, 6],
      buyer: {
        id: SESSION,
        gsmNumber: "+905320000000",
        identityNumber: "11111111111",
        city: "İstanbul",
        country: "Turkey",
        ip: "85.34.78.112",
      },
      shippingAddress: { contactName: "Ayşe Yılmaz", city: "İstanbul", zipCode: "34710" },
    })
    expect(request["basketItems"]).toEqual([
      { id: "cali_1", name: "Kupa", category1: "Ürün", itemType: "PHYSICAL", price: "240.00" },
      { id: "shipping", name: "Kargo", category1: "Kargo", itemType: "PHYSICAL", price: "90.50" },
    ])
  })

  it("offers one payment when the shop turned installments off, every count when it set none", () => {
    expect(checkoutFormRequest(input({ installments: { enabled: false, max: 6 } }))).toMatchObject({
      enabledInstallments: [1],
    })
    expect(checkoutFormRequest(input({ installments: { enabled: true, max: 0 } }))).toMatchObject({
      enabledInstallments: [1, 2, 3, 6, 9, 12],
    })
  })

  it("writes a Turkish mobile number as +90; anything else as typed", () => {
    expect(iyzicoPhone("05320000000")).toBe("+905320000000")
    expect(iyzicoPhone("532 000 00 00")).toBe("+905320000000")
    expect(iyzicoPhone("+49 30 1234567")).toBe("+49301234567")
  })
})

describe("checkout form calls against the fake iyzico", () => {
  let fake: FakeIyzico
  let api: IyzicoApi

  beforeEach(async () => {
    fake = await startFakeIyzico(account)
    api = createIyzicoApi({
      sandboxUrl: fake.url,
      liveUrl: fake.url,
      timeoutMs: 500,
      retry: { baseDelayMs: 1 },
      sleep: () => Promise.resolve(),
    })
  })

  afterEach(async () => {
    await fake.close()
  })

  it("opens a form, reads nothing until it is paid, then the signed result in kuruş", async () => {
    const form = await api.initializeCheckoutForm(credentials, input())
    const before = await api.retrieveCheckoutForm(credentials, {
      conversationId: SESSION,
      token: form.token,
    })
    fake.pay(form.token, { installment: 3, paidPrice: "345.00" })
    const after = await api.retrieveCheckoutForm(credentials, {
      conversationId: SESSION,
      token: form.token,
    })

    expect(form.pageUrl).toBe(`${fake.url}/fake-cpp/${form.token}`)
    expect(before).toBeNull()
    expect(after).toMatchObject({
      paid: true,
      fraudStatus: 1,
      price: 33050,
      paidPrice: 34500,
      basketId: SESSION,
      installment: 3,
      lastFour: "0008",
    })
    expect(after?.items.map(({ itemId, paid }) => [itemId, paid])).toEqual([
      ["cali_1", 24000],
      ["shipping", 9050],
    ])
  })

  it("refuses a paid result whose signature is not iyzico's", async () => {
    const form = await api.initializeCheckoutForm(credentials, input())
    fake.pay(form.token)
    const genuine = (await (
      await fetch(`${fake.url}${RETRIEVE}`, { method: "POST", body: "{}" })
    ).json()) as Record<string, unknown>
    fake.queue(RETRIEVE, {
      body: {
        ...genuine,
        status: "success",
        paymentStatus: "SUCCESS",
        paymentId: "1",
        price: 1,
        paidPrice: 1,
        currency: "TRY",
        basketId: SESSION,
        conversationId: SESSION,
        token: form.token,
        signature: "0".repeat(64),
      },
    })

    const code = await api
      .retrieveCheckoutForm(credentials, { conversationId: SESSION, token: form.token })
      .then(() => "no error")
      .catch((error: unknown) => (isProviderError(error) ? error.providerCode : String(error)))

    expect(code).toBe("signature_mismatch")
  })

  it("says the basket does not add up (5062), and never retries opening a form", async () => {
    const code = await api
      .initializeCheckoutForm(credentials, input({ amount: kurus(33000) }))
      .then(() => "no error")
      .catch((error: unknown) => (isProviderError(error) ? error.providerCode : String(error)))

    expect(code).toBe("basket_total_mismatch")
    expect(fake.requests).toHaveLength(1)
  })
})
