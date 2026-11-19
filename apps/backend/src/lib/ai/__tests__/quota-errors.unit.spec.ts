import { isProviderError } from "../../errors/errors"
import type { SafeFetchResponse } from "../../security/safe-fetch"
import { geminiImageEdit } from "../connectors/gemini-image"
import { openAiCompatibleText } from "../connectors/openai-compatible"
import { googleQuotaUsedUp } from "../connectors/status-failure"
import { isRetryableAiError } from "../errors"
import { failureOf, notTakenByService } from "../outcome"
import { findAiService } from "../registry/services"
import type { AiService } from "../registry/services"

/**
 * A 429 told apart (recorded answers only; nothing leaves the machine): a
 * used-up or zero quota is `ai.provider_quota` and is not tried again; a
 * rate, or a body that cannot be read, stays `ai.provider_busy`. The
 * service's words never reach the error.
 */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-not-a-real-one"
const SAID = "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0"

const google = (error: Record<string, unknown>) => JSON.stringify({ error })
const violation = (quotaId: string, quotaValue?: string) => ({
  quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
  quotaId,
  quotaDimensions: { location: "global", model: "test-image-model" },
  ...(quotaValue === undefined ? {} : { quotaValue }),
})
const failureDetail = (...violations: unknown[]) => ({
  "@type": "type.googleapis.com/google.rpc.QuotaFailure",
  violations,
})
const RETRY = { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" }

// What a free tier project gets for an image model: zero on every quota, the per-minute one too
const FREE_TIER_ZERO = google({
  code: 429,
  message: `You exceeded your current quota. * ${SAID}, model: test-image-model`,
  status: "RESOURCE_EXHAUSTED",
  details: [
    failureDetail(
      violation("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "0"),
      violation("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "0")
    ),
    RETRY,
  ],
})
// A free tier per-minute rate with room left in the day: busy, not out of quota
const PER_MINUTE = google({
  code: 429,
  message: "You exceeded your current quota. * per minute, limit: 10",
  status: "RESOURCE_EXHAUSTED",
  details: [failureDetail(violation("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "10"))],
})

const answer = (status: number, body: string): SafeFetchResponse => ({
  status,
  headers: { "content-type": "application/json" },
  body: Buffer.from(body),
  url: "https://example.invalid/",
})

function fakeFetch(steps: SafeFetchResponse[]) {
  const calls: string[] = []
  const fetch = (input: string | URL) => {
    calls.push(String(input))
    const step = steps.shift()
    return step === undefined ? Promise.reject(new Error("no more answers")) : Promise.resolve(step)
  }
  return { fetch, calls }
}

const serviceOf = (id: string): AiService => {
  const service = findAiService(id, "test")
  if (service === null) {
    throw new Error(`no service ${id}`)
  }
  return service
}

async function failure(run: Promise<unknown>) {
  const error: unknown = await run.then(
    () => null,
    (thrown: unknown) => thrown
  )
  if (!isProviderError(error)) {
    throw new Error("expected a provider error")
  }
  expect(JSON.stringify(error)).not.toContain(KEY)
  expect(JSON.stringify(error)).not.toContain("limit: 0")
  return { key: error.safeMessage, code: error.providerCode }
}

const PNG = { mimeType: "image/png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }

function geminiImage(steps: SafeFetchResponse[]) {
  const service = serviceOf("gemini")
  const target = service.capabilities.image_edit
  if (target?.connector !== "gemini-image") {
    throw new Error("no Gemini image target")
  }
  const { fetch, calls } = fakeFetch(steps)
  const connector = geminiImageEdit({
    service,
    target,
    apiKey: KEY,
    fetch,
    wait: () => Promise.resolve(),
  })
  return { connector, calls }
}

function text(id: string, steps: SafeFetchResponse[]) {
  const service = serviceOf(id)
  const target = service.capabilities.text
  if (target?.connector !== "openai-compatible") {
    throw new Error(`no text target for ${id}`)
  }
  const { fetch, calls } = fakeFetch(steps)
  const connector = openAiCompatibleText({
    service,
    target,
    apiKey: KEY,
    fetch,
    wait: () => Promise.resolve(),
  })
  return { connector, calls }
}

const REQUEST = { system: "Görev.", data: '{"data":{"name":"Kupa"}}', maxTokens: 50 }

describe("a Gemini 429's body (googleQuotaUsedUp)", () => {
  it("reads a zero or daily quota, `limit: 0` and `quota_exceeded` as used up", () => {
    const used = [
      FREE_TIER_ZERO,
      google({ code: 429, details: [failureDetail(violation("GenerateRequestsPerDay-x"))] }),
      google({ code: 429, status: "RESOURCE_EXHAUSTED", message: SAID }),
      google({ code: "quota_exceeded", message: "You have exceeded your daily quota." }),
      // The compatibility endpoint may wrap the error in a list
      `[${FREE_TIER_ZERO}]`,
    ]
    for (const body of used) {
      expect(googleQuotaUsedUp(Buffer.from(body))).toBe(true)
    }
  })

  it("reads a per-minute rate, `-FreeTier` alone, and anything unreadable as not used up", () => {
    const rates = [
      PER_MINUTE,
      google({ code: "rate_limit_exceeded", message: "per-minute limit" }),
      google({ code: 429, status: "RESOURCE_EXHAUSTED", message: "limit: 0.5 per second" }),
      google({ code: 429, details: [{ "@type": "x.QuotaFailure", violations: "nope" }] }),
      "",
      "not json",
      "{}",
      JSON.stringify({ error: "quota" }),
      // A body far larger than an error is not read
      google({ code: "quota_exceeded", message: "x".repeat(70 * 1024) }),
    ]
    for (const body of rates) {
      expect(googleQuotaUsedUp(Buffer.from(body))).toBe(false)
    }
  })
})

describe("Gemini image editing on 429", () => {
  it("is a used-up quota, tried once, with our code and none of the service's words", async () => {
    const { connector, calls } = geminiImage([answer(429, FREE_TIER_ZERO)])
    expect(await failure(connector.edit({ image: PNG, background: "white" }))).toEqual({
      key: "ai.provider_quota",
      code: "http_429_quota",
    })
    expect(calls).toHaveLength(1)
  })

  it("is a busy service for a rate or a body it cannot read, tried again once", async () => {
    for (const body of [PER_MINUTE, "", "<html>busy</html>"]) {
      const { connector, calls } = geminiImage([answer(429, body), answer(429, body)])
      expect(await failure(connector.edit({ image: PNG, background: "white" }))).toEqual({
        key: "ai.provider_busy",
        code: "http_429",
      })
      expect(calls).toHaveLength(2)
    }
  })
})

describe("text connectors on 429", () => {
  it("tells Gemini's used-up quota apart on the compatibility endpoint too", async () => {
    const { connector, calls } = text("gemini", [answer(429, `[${FREE_TIER_ZERO}]`)])
    expect(await failure(connector.complete(REQUEST))).toEqual({
      key: "ai.provider_quota",
      code: "http_429_quota",
    })
    expect(calls).toHaveLength(1)
  })

  it("leaves a service that documents no quota body as busy, whatever its body says", async () => {
    const { connector } = text("deepseek", [answer(429, FREE_TIER_ZERO), answer(429, "{}")])
    expect(await failure(connector.complete(REQUEST))).toEqual({
      key: "ai.provider_busy",
      code: "http_429",
    })
  })

  it("maps MiniMax's documented plan and credit codes", async () => {
    const cases = [
      [2056, "ai.provider_quota"],
      [2061, "ai.provider_quota"],
      [2067, "ai.provider_quota"],
      [2068, "ai.provider_quota"],
      [2053, "ai.provider_balance"],
    ] as const
    for (const [code, key] of cases) {
      const body = JSON.stringify({ base_resp: { status_code: code, status_msg: SAID } })
      const { connector, calls } = text("minimax", [answer(200, body)])
      expect(await failure(connector.complete(REQUEST))).toEqual({
        key,
        code: `body_${String(code)}`,
      })
      expect(calls).toHaveLength(1)
    }
  })
})

describe("what a used-up quota is recorded as", () => {
  it("is recorded as the busy 429 was: answered, not taken, never retried", () => {
    expect(notTakenByService("ai.provider_busy", "http_429")).toBe(true)
    expect(notTakenByService("ai.provider_quota", "http_429_quota")).toBe(true)
    expect(notTakenByService("ai.provider_quota", "body_2056")).toBe(true)
    expect(isRetryableAiError("ai.provider_busy")).toBe(true)
    expect(isRetryableAiError("ai.provider_quota")).toBe(false)
  })

  it("keeps our code in the usage failure", async () => {
    const { connector } = geminiImage([answer(429, FREE_TIER_ZERO)])
    const thrown: unknown = await connector.edit({ image: PNG, background: "white" }).then(
      () => null,
      (error: unknown) => error
    )
    expect(failureOf(thrown)).toEqual({
      status: "failed",
      key: "ai.provider_quota",
      code: "http_429_quota",
      unwell: false,
      answered: true,
    })
  })
})
