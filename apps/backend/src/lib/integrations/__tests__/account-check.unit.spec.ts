import {
  fakeIyzicoAccount,
  fakePaytrAccount,
  fakePttAccount,
  fakeSecret,
  startFakeIyzico,
  startFakePaytr,
  startFakePtt,
} from "@qticaret/testing"
import type { FakeIyzico, FakePaytr, FakePtt } from "@qticaret/testing"
import { checkAccount } from "../account-check"
import { iyzicoHealthCheck } from "../health/iyzico-check"
import { paytrHealthCheck } from "../health/paytr-check"
import { pttHealthCheck } from "../health/ptt-check"

// The shared PayTR client reads its address once: one fake for the whole file
const account = fakePaytrAccount()
const details = (overrides: { merchant_id?: string; merchant_salt?: string } = {}) => ({
  settings: { merchant_id: overrides.merchant_id ?? account.merchantId, test_mode: true },
  secrets: {
    merchant_key: account.merchantKey,
    merchant_salt: overrides.merchant_salt ?? account.merchantSalt,
  },
})

describe("checkAccount (adr/0027 §4)", () => {
  let fake: FakePaytr

  beforeAll(async () => {
    fake = await startFakePaytr(account)
    process.env["PAYTR_BASE_URL"] = fake.url
  })

  afterAll(async () => {
    delete process.env["PAYTR_BASE_URL"]
    await fake.close()
  })

  it("tells valid details from a wrong shop number or secret", async () => {
    expect(await checkAccount("paytr", details())).toBe("valid")
    expect(await checkAccount("paytr", details({ merchant_id: "999999" }))).toBe("merchant_invalid")
    expect(await checkAccount("paytr", details({ merchant_salt: fakeSecret() }))).toBe(
      "secret_invalid"
    )
  })

  it("calls details without a shop number wrong without asking", async () => {
    fake.requests.length = 0

    expect(await checkAccount("paytr", { settings: {}, secrets: {} })).toBe("merchant_invalid")
    expect(fake.requests).toHaveLength(0)
  })

  it("calls PayTR unreachable only when it was not heard from", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      fake.queue("/odeme/durum-sorgu", { status: 502, body: "bad gateway" })
    }
    expect(await checkAccount("paytr", details())).toBe("unreachable")

    fake.queue("/odeme/durum-sorgu", { hang: true })
    expect(await checkAccount("paytr", details(), AbortSignal.timeout(200))).toBe("unreachable")
  })

  it("fails a check PayTR answered out of its documentation", async () => {
    fake.queue("/odeme/durum-sorgu", { body: { status: "error", err_no: "099" } })
    expect(await checkAccount("paytr", details())).toBe("failed")

    fake.queue("/odeme/durum-sorgu", { body: "<html>maintenance</html>" })
    expect(await checkAccount("paytr", details())).toBe("failed")
  })

  it("reports health from the stored account", async () => {
    const signal = AbortSignal.timeout(5_000)

    expect(await paytrHealthCheck(() => Promise.resolve(null)).check(signal)).toEqual({
      status: "not_configured",
    })
    expect(await paytrHealthCheck(() => Promise.resolve(details())).check(signal)).toEqual({
      status: "ok",
    })
    expect(
      await paytrHealthCheck(() => Promise.resolve(details({ merchant_id: "999999" }))).check(
        signal
      )
    ).toEqual({ status: "down", reason: "auth_failed" })
  })
})

describe("checkAccount for iyzico", () => {
  // The shared client reads its address once: one fake for the sandbox and the live service
  const keys = fakeIyzicoAccount()
  const details = (secrets: Partial<{ api_key: string; secret_key: string }> = {}) => ({
    settings: { test_mode: true },
    secrets: { api_key: keys.apiKey, secret_key: keys.secretKey, ...secrets },
  })
  let fake: FakeIyzico

  beforeAll(async () => {
    fake = await startFakeIyzico(keys)
    process.env["IYZICO_BASE_URL"] = fake.url
  })

  afterAll(async () => {
    delete process.env["IYZICO_BASE_URL"]
    await fake.close()
  })

  it("tells valid keys from an unknown API key or a wrong secret key", async () => {
    expect(await checkAccount("iyzico", details())).toBe("valid")
    expect(await checkAccount("iyzico", details({ api_key: `sandbox-${fakeSecret()}` }))).toBe(
      "merchant_invalid"
    )
    expect(await checkAccount("iyzico", details({ secret_key: fakeSecret() }))).toBe(
      "secret_invalid"
    )
  })

  it("calls iyzico unreachable only when it was not heard from", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      fake.queue("/payment/iyzipos/installment", { status: 502, body: "bad gateway" })
    }
    expect(await checkAccount("iyzico", details())).toBe("unreachable")
  })

  it("reports health from the stored account", async () => {
    const signal = AbortSignal.timeout(5_000)

    expect(await iyzicoHealthCheck(() => Promise.resolve(null)).check(signal)).toEqual({
      status: "not_configured",
    })
    expect(await iyzicoHealthCheck(() => Promise.resolve(details())).check(signal)).toEqual({
      status: "ok",
    })
    expect(
      await iyzicoHealthCheck(() => Promise.resolve(details({ secret_key: fakeSecret() }))).check(
        signal
      )
    ).toEqual({ status: "down", reason: "auth_failed" })
  })
})

describe("checkAccount for PTT Kargo", () => {
  // The shared client reads its address once
  const keys = fakePttAccount()
  const details = (password = keys.password) => ({
    settings: { customer_id: keys.customerId, test_mode: false },
    secrets: { password },
  })
  let fake: FakePtt

  beforeAll(async () => {
    fake = await startFakePtt(keys)
    process.env["PTT_BASE_URL"] = fake.url
  })

  afterAll(async () => {
    delete process.env["PTT_BASE_URL"]
    await fake.close()
  })

  it("never calls an account valid: PTT answers a made-up one alike", async () => {
    expect(await checkAccount("ptt", details())).toBe("unconfirmed")
    expect(await checkAccount("ptt", details("uydurma-sifre"))).toBe("unconfirmed")
  })

  it("refuses it only when PTT's words name the account", async () => {
    fake.queue("gonderiSorgu2", "code:0:Kullanıcı adı veya şifre hatalı.")
    expect(await checkAccount("ptt", details())).toBe("secret_invalid")
  })

  it("reports health as reached, or down when PTT refuses the account", async () => {
    const signal = AbortSignal.timeout(5_000)
    const health = pttHealthCheck(() => Promise.resolve(details()))

    expect(await health.check(signal)).toEqual({ status: "ok" })
    fake.queue("gonderiSorgu2", "code:0:Kullanıcı adı veya şifre hatalı.")
    expect(await health.check(signal)).toEqual({ status: "down", reason: "auth_failed" })
  })
})
