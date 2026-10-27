import { fakePaytrAccount, fakeSecret, startFakePaytr } from "@qticaret/testing"
import type { FakePaytr } from "@qticaret/testing"
import { checkAccount } from "../account-check"
import { paytrHealthCheck } from "../health/paytr-check"

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
