import { fakeIyzicoAccount, fakeSecret, startFakeIyzico } from "@qticaret/testing"
import type { FakeIyzico } from "@qticaret/testing"
import { isProviderError } from "../../../errors"
import { createIyzicoApi } from "../client"
import type { IyzicoApi } from "../client"
import { iyzicoErrorCode } from "../errors"
import type { IyzicoCredentials } from "../types"

// Made-up sandbox and live accounts, fresh per run; each fake checks every signature
const sandboxAccount = fakeIyzicoAccount()
const liveAccount = { apiKey: fakeSecret(), secretKey: fakeSecret() }
const sandboxCredentials: IyzicoCredentials = { ...sandboxAccount, testMode: true }
const INSTALLMENT = "/payment/iyzipos/installment"

const codeOf = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run
  } catch (error) {
    return isProviderError(error) ? error.providerCode : String(error)
  }
  return "no error"
}

describe("iyzico client against the fake server", () => {
  let sandbox: FakeIyzico
  let live: FakeIyzico
  let api: IyzicoApi

  beforeEach(async () => {
    sandbox = await startFakeIyzico(sandboxAccount)
    live = await startFakeIyzico(liveAccount)
    api = createIyzicoApi({
      sandboxUrl: sandbox.url,
      liveUrl: live.url,
      timeoutMs: 500,
      retry: { baseDelayMs: 1 },
      sleep: () => Promise.resolve(),
    })
  })

  afterEach(async () => {
    await Promise.all([sandbox.close(), live.close()])
  })

  it("accepts a sandbox account at the sandbox address with a read that changes nothing", async () => {
    expect(await api.checkCredentials(sandboxCredentials)).toBe("valid")
    expect(sandbox.requests).toHaveLength(1)
    expect(sandbox.requests[0]?.path).toBe(INSTALLMENT)
    expect(sandbox.requests[0]?.body).toMatchObject({ locale: "tr", price: "1.0" })
    expect(sandbox.requests[0]?.body["conversationId"]).toMatch(/^qtcheck-/)
    expect(live.requests).toHaveLength(0)
  })

  it("goes to the live address with test mode off, where a sandbox key is unknown", async () => {
    expect(await api.checkCredentials({ ...liveAccount, testMode: false })).toBe("valid")
    expect(await api.checkCredentials({ ...sandboxAccount, testMode: false })).toBe(
      "merchant_invalid"
    )
    expect(live.requests).toHaveLength(2)
    expect(sandbox.requests).toHaveLength(0)
  })

  it("tells a wrong secret key from an unknown API key", async () => {
    expect(await api.checkCredentials({ ...sandboxCredentials, secretKey: fakeSecret() })).toBe(
      "secret_invalid"
    )
    expect(
      await api.checkCredentials({ ...sandboxCredentials, apiKey: `sandbox-${fakeSecret()}` })
    ).toBe("merchant_invalid")
  })

  it("throws iyzico's own code for any other failure", async () => {
    sandbox.queue(INSTALLMENT, {
      body: { status: "failure", errorCode: "12", errorMessage: "Kart numarası geçersizdir" },
    })

    expect(await codeOf(api.checkCredentials(sandboxCredentials))).toBe("error_12")
  })

  it("asks again after iyzico turns a read away, and reports one it never answers", async () => {
    sandbox.queue(INSTALLMENT, { status: 503, body: "busy" })
    expect(await api.checkCredentials(sandboxCredentials)).toBe("valid")

    for (let attempt = 0; attempt < 5; attempt++) {
      sandbox.queue(INSTALLMENT, { drop: true })
    }
    const error = await api.checkCredentials(sandboxCredentials).catch((caught: unknown) => caught)
    expect(isProviderError(error) && error.retryable).toBe(true)
  })

  it("gives up a check when the caller stops waiting", async () => {
    sandbox.queue(INSTALLMENT, { hang: true })
    const waiting = new AbortController()
    const check = api.checkCredentials(sandboxCredentials, { signal: waiting.signal })
    waiting.abort()

    expect(await codeOf(check)).toBe("aborted")
  })

  it("treats an answer outside the documented shape as invalid", async () => {
    sandbox.queue(INSTALLMENT, { body: { status: "maybe" } })

    expect(await codeOf(api.checkCredentials(sandboxCredentials))).toBe("invalid_response")
  })
})

describe("iyzico error codes", () => {
  it("names the codes the sandbox answered and keeps the others visible", () => {
    expect(iyzicoErrorCode("1000")).toBe("signature_invalid")
    expect(iyzicoErrorCode("1001")).toBe("api_key_invalid")
    expect(iyzicoErrorCode("10051")).toBe("error_10051")
    expect(iyzicoErrorCode("<script>")).toBe("error")
    expect(iyzicoErrorCode(undefined)).toBe("error")
  })
})
