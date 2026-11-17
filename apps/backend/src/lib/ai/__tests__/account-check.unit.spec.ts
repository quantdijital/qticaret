import { logger } from "../../logging"
import { SafeFetchError } from "../../security/safe-fetch"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { aiAccountChecker, checkAiAccount } from "../account-check"

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-not-a-real-one"
const SERVICE_SAID = "Invalid key test-key-not-a-real-one for account 42"

const answer = (status: number, body: unknown): SafeFetchResponse => ({
  status,
  headers: {},
  body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
  url: "https://example.invalid/",
})

const MODELS = { object: "list", data: [{ id: "model-a", object: "model", owned_by: "x" }] }

function fakeFetch(step: SafeFetchResponse | Error) {
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const fetch = (input: URL | string, options?: SafeFetchOptions) => {
    calls.push({ url: String(input), options: options ?? {} })
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step)
  }
  return { fetch, calls }
}

const check = (id: string, step: SafeFetchResponse | Error) => {
  const { fetch, calls } = fakeFetch(step)
  return {
    calls,
    result: checkAiAccount(id, KEY, AbortSignal.timeout(5_000), { fetch, nodeEnv: "test" }),
  }
}

describe("AI account check (adr/0071 §3, §9)", () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it.each([
    ["deepseek", "https://api.deepseek.com/models"],
    ["minimax", "https://api.minimax.io/v1/models"],
    ["gemini", "https://generativelanguage.googleapis.com/v1beta/openai/models"],
  ])("asks %s for its model list with the key in the header alone", async (id, url) => {
    const { calls, result } = check(id, answer(200, MODELS))

    expect(await result).toBe("valid")
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(url)
    expect(calls[0]?.url).not.toContain(KEY)
    expect(calls[0]?.options).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { Authorization: `Bearer ${KEY}` },
    })
    expect(calls[0]?.options.body).toBeUndefined()
  })

  it("calls a refused key secret_invalid, and never logs the key or what the service said", async () => {
    for (const status of [401, 403]) {
      expect(await check("deepseek", answer(status, { error: SERVICE_SAID })).result).toBe(
        "secret_invalid"
      )
    }
    expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY)
    expect(JSON.stringify(warn.mock.calls)).not.toContain("account 42")
  })

  it("gives no verdict when the service was not heard from", async () => {
    for (const status of [408, 429, 500, 503]) {
      expect(await check("gemini", answer(status, SERVICE_SAID)).result).toBe("unreachable")
    }
    for (const reason of ["timeout", "aborted", "dns_failed", "request_failed"] as const) {
      expect(await check("gemini", new SafeFetchError(reason)).result).toBe("unreachable")
    }
  })

  it("calls an answer out of the documentation failed", async () => {
    expect(await check("deepseek", answer(200, "<html>hello</html>")).result).toBe("failed")
    expect(await check("deepseek", answer(200, { object: "model" })).result).toBe("failed")
    expect(await check("deepseek", answer(404, {})).result).toBe("failed")
    expect(await check("deepseek", new SafeFetchError("redirect_not_allowed")).result).toBe(
      "failed"
    )
    expect(await check("deepseek", new Error("boom")).result).toBe("failed")
  })

  it("takes a key with no balance left as a key that works", async () => {
    expect(await check("gemini", answer(402, {})).result).toBe("valid")
  })

  it("reads MiniMax's own codes in a 200 answer", async () => {
    const coded = (code: number) => answer(200, { base_resp: { status_code: code } })

    expect(await check("minimax", coded(1004)).result).toBe("secret_invalid")
    expect(await check("minimax", coded(2049)).result).toBe("secret_invalid")
    expect(await check("minimax", coded(1002)).result).toBe("unreachable")
    expect(await check("minimax", coded(1008)).result).toBe("valid")
    expect(await check("minimax", coded(424242)).result).toBe("failed")
  })

  it("checks the fake service without leaving the machine, and only where it exists", async () => {
    const { calls, result } = check("fake", answer(500, {}))

    expect(await result).toBe("valid")
    expect(calls).toHaveLength(0)
    const live = fakeFetch(answer(200, MODELS))
    expect(
      await checkAiAccount("fake", KEY, AbortSignal.timeout(1_000), {
        fetch: live.fetch,
        nodeEnv: "production",
      })
    ).toBe("failed")
    expect(live.calls).toHaveLength(0)
  })

  it("refuses a service the registry does not know", async () => {
    const { calls, result } = check("openai", answer(200, MODELS))

    expect(await result).toBe("failed")
    expect(calls).toHaveLength(0)
  })

  it("calls a missing key secret_invalid without asking", async () => {
    expect(await aiAccountChecker("deepseek")({ secrets: {} }, AbortSignal.timeout(1_000))).toBe(
      "secret_invalid"
    )
  })
})
