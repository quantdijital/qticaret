import { isProviderError } from "../../errors/errors"
import { SafeFetchError } from "../../security/safe-fetch"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { openAiCompatibleText } from "../connectors/openai-compatible"
import { findAiService } from "../registry/services"
import type { AiService, OpenAiCompatibleTarget } from "../registry/services"

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-not-a-real-one"
const SERVICE_SAID = "Invalid key test-key-not-a-real-one for account 42"

type Step = SafeFetchResponse | Error

const answer = (status: number, body: unknown, headers: Record<string, string> = {}): Step => ({
  status,
  headers,
  body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
  url: "https://example.invalid/",
})

const completion = (content: string, extra: Record<string, unknown> = {}) => ({
  choices: [{ message: { role: "assistant", content }, finish_reason: "stop", ...extra }],
  usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138 },
})

function serviceOf(id: string): { service: AiService; target: OpenAiCompatibleTarget } {
  const service = findAiService(id, "test")
  const target = service?.capabilities.text
  if (!service || target?.connector !== "openai-compatible") {
    throw new Error(`no text target for ${id}`)
  }
  return { service, target }
}

function connectorFor(id: string, steps: Step[]) {
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const waits: number[] = []
  const connector = openAiCompatibleText({
    ...serviceOf(id),
    apiKey: KEY,
    fetch: (input, options) => {
      calls.push({ url: String(input), options: options ?? {} })
      const step = steps.shift()
      if (step === undefined) {
        throw new Error("no more answers")
      }
      return step instanceof Error ? Promise.reject(step) : Promise.resolve(step)
    },
    wait: (ms) => {
      waits.push(ms)
      return Promise.resolve()
    },
  })
  return { connector, calls, waits }
}

const REQUEST = { system: "Görev.", data: '{"data":{"name":"Keten Gömlek"}}', maxTokens: 200 }

async function failure(run: Promise<unknown>) {
  const error: unknown = await run.then(
    () => null,
    (thrown: unknown) => thrown
  )
  if (!isProviderError(error)) {
    throw new Error("expected a provider error")
  }
  return error
}

describe("OpenAI compatible text connector (adr/0071 §8, §9)", () => {
  it("posts the registered address with the key in the header only", async () => {
    const { connector, calls } = connectorFor("deepseek", [
      answer(200, completion(" Keten Gömlek ")),
    ])

    const result = await connector.complete({ ...REQUEST, json: true })

    expect(result).toEqual({ text: "Keten Gömlek", usage: { inputTokens: 120, outputTokens: 18 } })
    expect(calls).toHaveLength(1)
    const [{ url, options }] = calls as [(typeof calls)[number]]
    expect(url).toBe("https://api.deepseek.com/chat/completions")
    expect(url).not.toContain(KEY)
    expect(options.method).toBe("POST")
    expect(options.redirect).toBe("error")
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(options.headers).toEqual({
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    })
    expect(String(options.body)).not.toContain(KEY)
    expect(JSON.parse(String(options.body))).toEqual({
      thinking: { type: "disabled" },
      model: "deepseek-flash",
      messages: [
        { role: "system", content: REQUEST.system },
        { role: "user", content: REQUEST.data },
      ],
      stream: false,
      max_tokens: 200,
      response_format: { type: "json_object" },
    })
  })

  it("speaks each service's own dialect from the registry", async () => {
    const minimax = connectorFor("minimax", [answer(200, completion("<think>hmm</think>Sonuç"))])
    expect((await minimax.connector.complete({ ...REQUEST, json: true })).text).toBe("Sonuç")
    const sent = JSON.parse(String(minimax.calls[0]?.options.body)) as Record<string, unknown>
    expect(minimax.calls[0]?.url).toBe("https://api.minimax.io/v1/chat/completions")
    expect(sent).toMatchObject({ model: "MiniMax-M3.1-Flash", max_completion_tokens: 200 })
    // No JSON mode is documented for it: the field is not sent
    expect(sent).not.toHaveProperty("response_format")
    expect(sent).not.toHaveProperty("max_tokens")

    const gemini = connectorFor("gemini", [answer(200, completion("Sonuç"))])
    await gemini.connector.complete(REQUEST)
    expect(gemini.calls[0]?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    )
    expect(gemini.calls[0]?.url).not.toContain("key=")
  })

  it.each([
    [401, "ai.key_rejected"],
    [403, "ai.key_rejected"],
    [402, "ai.provider_balance"],
    [400, "ai.provider_response_invalid"],
    [404, "ai.provider_response_invalid"],
  ])("maps %i to %s without a second try", async (status, key) => {
    const { connector, calls, waits } = connectorFor("deepseek", [
      answer(status, { error: { message: SERVICE_SAID } }),
    ])

    const error = await failure(connector.complete(REQUEST))

    expect(error).toMatchObject({
      safeMessage: key,
      provider: "deepseek",
      providerCode: `http_${String(status)}`,
      retryable: false,
    })
    expect(calls).toHaveLength(1)
    expect(waits).toEqual([])
  })

  it.each([
    [429, "ai.provider_busy"],
    [500, "ai.provider_unavailable"],
    [503, "ai.provider_unavailable"],
  ])("tries %i once more, then gives %s", async (status, key) => {
    const { connector, calls, waits } = connectorFor("deepseek", [
      answer(status, SERVICE_SAID, { "retry-after": "2" }),
      answer(status, SERVICE_SAID),
      answer(200, completion("never reached")),
    ])

    const error = await failure(connector.complete(REQUEST))

    expect(error.safeMessage).toBe(key)
    expect(calls).toHaveLength(2)
    // The service's Retry-After, in milliseconds
    expect(waits).toEqual([2000])
  })

  it("answers after one retry when the second try succeeds", async () => {
    const { connector, calls, waits } = connectorFor("deepseek", [
      answer(429, {}),
      answer(200, completion("Keten Gömlek")),
    ])

    expect((await connector.complete(REQUEST)).text).toBe("Keten Gömlek")
    expect(calls).toHaveLength(2)
    expect(waits).toEqual([1000])
  })

  it("does not wait for a long Retry-After; the error carries it", async () => {
    const { connector, calls } = connectorFor("deepseek", [
      answer(429, {}, { "retry-after": "120" }),
    ])

    const error = await failure(connector.complete(REQUEST))

    expect(error).toMatchObject({ safeMessage: "ai.provider_busy", retryAfterMs: 120_000 })
    expect(calls).toHaveLength(1)
  })

  it("never tries again after a timeout or a cut answer: it may have been charged", async () => {
    const reset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })
    for (const [thrown, key] of [
      [new SafeFetchError("timeout"), "ai.timeout"],
      [new SafeFetchError("aborted"), "ai.timeout"],
      [new SafeFetchError("request_failed", { cause: reset }), "ai.provider_unavailable"],
      [new SafeFetchError("response_too_large", { status: 200 }), "ai.provider_response_invalid"],
      [new SafeFetchError("redirect_not_allowed"), "ai.provider_response_invalid"],
      [new SafeFetchError("address_not_allowed"), "ai.provider_response_invalid"],
    ] as const) {
      const { connector, calls } = connectorFor("deepseek", [thrown, answer(200, completion("x"))])
      const error = await failure(connector.complete(REQUEST))
      expect(error.safeMessage).toBe(key)
      expect(calls).toHaveLength(1)
    }
  })

  it("tries again once when no connection was made at all", async () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    const { connector, calls } = connectorFor("deepseek", [
      new SafeFetchError("request_failed", { cause: refused }),
      new SafeFetchError("dns_failed"),
      answer(200, completion("never reached")),
    ])

    expect((await failure(connector.complete(REQUEST))).safeMessage).toBe("ai.provider_unavailable")
    expect(calls).toHaveLength(2)
  })

  it("tells a connection never made from one cut after sending (D3)", async () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    const reset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" })
    const never = connectorFor("deepseek", [
      new SafeFetchError("request_failed", { cause: refused }),
      new SafeFetchError("request_failed", { cause: refused }),
    ])
    const cut = connectorFor("deepseek", [new SafeFetchError("request_failed", { cause: reset })])

    expect(await failure(never.connector.complete(REQUEST))).toMatchObject({
      safeMessage: "ai.provider_unavailable",
      providerCode: "connect_failed",
    })
    expect(await failure(cut.connector.complete(REQUEST))).toMatchObject({
      safeMessage: "ai.provider_unavailable",
      providerCode: "request_failed",
    })
  })

  it("gives a timeout when the caller gives up", async () => {
    const { connector, calls } = connectorFor("deepseek", [new SafeFetchError("aborted")])
    const controller = new AbortController()
    controller.abort()

    const error = await failure(connector.complete({ ...REQUEST, signal: controller.signal }))

    expect(error.safeMessage).toBe("ai.timeout")
    expect(calls).toHaveLength(1)
  })

  it("keeps the service's answer, the headers and the key out of the error", async () => {
    const steps = () => [
      answer(401, { error: { message: SERVICE_SAID, type: "authentication_error" } }),
    ]
    const error = await failure(connectorFor("deepseek", steps()).connector.complete(REQUEST))

    const everything = [
      JSON.stringify(error),
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
      (error as unknown as Error).message,
      String((error as { stack?: unknown }).stack),
    ].join("\n")
    expect(everything).not.toContain(KEY)
    expect(everything).not.toContain("Invalid key")
    expect(everything).not.toContain("account 42")
    expect(everything).not.toContain("Bearer")
    expect(everything).not.toContain("Authorization")
    expect((error as { cause?: unknown }).cause).toBeUndefined()
    expect((error as { providerMessage?: unknown }).providerMessage).toBeUndefined()
  })

  it("keeps a thrown error's own text out too", async () => {
    const leaky = new Error(`request to https://x/?key=${KEY} failed`)
    const error = await failure(connectorFor("deepseek", [leaky]).connector.complete(REQUEST))

    expect(error.safeMessage).toBe("ai.provider_response_invalid")
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(KEY)
  })

  it("reads the codes a service writes in the body, whatever the status", async () => {
    for (const [status, code, key, tries] of [
      [200, 1004, "ai.key_rejected", 1],
      [401, 2049, "ai.key_rejected", 1],
      [200, 1008, "ai.provider_balance", 1],
      [200, 1027, "ai.content_blocked", 1],
      [200, 1002, "ai.provider_busy", 2],
      [200, 9999, "ai.provider_response_invalid", 1],
    ] as const) {
      const body = { base_resp: { status_code: code, status_msg: SERVICE_SAID } }
      const { connector, calls } = connectorFor("minimax", [
        answer(status, body),
        answer(status, body),
      ])
      const error = await failure(connector.complete(REQUEST))
      expect(error).toMatchObject({ safeMessage: key, providerCode: `body_${String(code)}` })
      expect(calls).toHaveLength(tries)
    }
    // A success says code 0
    const ok = { ...completion("Sonuç"), base_resp: { status_code: 0, status_msg: "" } }
    const fine = connectorFor("minimax", [answer(200, ok)])
    expect((await fine.connector.complete(REQUEST)).text).toBe("Sonuç")
  })

  it("refuses an answer that is not a completion", async () => {
    for (const [body, key] of [
      ["<html>gateway</html>", "ai.provider_response_invalid"],
      [{ choices: [] }, "ai.provider_response_invalid"],
      [completion("   "), "ai.provider_response_invalid"],
      [{ choices: [{ message: { content: null } }] }, "ai.provider_response_invalid"],
      [completion("", { finish_reason: "content_filter" }), "ai.content_blocked"],
    ] as const) {
      const { connector, calls } = connectorFor("deepseek", [answer(200, body)])
      expect((await failure(connector.complete(REQUEST))).safeMessage).toBe(key)
      expect(calls).toHaveLength(1)
    }
  })

  it("leaves out counts the service did not give", async () => {
    const { connector } = connectorFor("deepseek", [
      answer(200, { choices: [{ message: { content: "Sonuç" } }], usage: { prompt_tokens: -1 } }),
    ])
    expect(await connector.complete(REQUEST)).toEqual({ text: "Sonuç", usage: {} })
  })

  it("calls nothing that the registry does not name", async () => {
    const { service, target } = serviceOf("deepseek")
    const calls: string[] = []
    const fetch = (input: string | URL) => {
      calls.push(String(input))
      return Promise.resolve(answer(200, completion("x")) as SafeFetchResponse)
    }
    for (const moved of [
      { ...target, baseUrl: "https://evil.example" },
      { ...target, baseUrl: "http://api.deepseek.com" },
      { ...target, path: "/chat/completions?key=1" },
      { ...target, baseUrl: "https://user:pass@api.deepseek.com" },
    ]) {
      const connector = openAiCompatibleText({ service, target: moved, apiKey: KEY, fetch })
      const error = await failure(connector.complete(REQUEST))
      expect(error).toMatchObject({
        safeMessage: "ai.provider_response_invalid",
        providerCode: "endpoint_not_registered",
      })
    }
    expect(calls).toEqual([])
  })

  it("takes no image: vision has its own connector", async () => {
    const { connector, calls } = connectorFor("deepseek", [])
    const images = [{ mimeType: "image/png", bytes: Buffer.from([1]) }]
    const error = await failure(connector.complete({ ...REQUEST, images }))
    expect(error.safeMessage).toBe("ai.input_unsupported")
    expect(calls).toEqual([])
  })
})
