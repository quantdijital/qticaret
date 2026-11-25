import { aiTargetUncapped } from "@qticaret/types/control-plane"
import { logger } from "../../logging"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { checkAiAccount, replacesUnchecked } from "../account-check"
import { openAiCompatibleText } from "../connectors/openai-compatible"
import { openAiCompatibleTools } from "../connectors/openai-tools"
import { jsonObjectOf, productCardOf } from "../product-card"
import { DATA_RULE, DATA_LAST } from "../prompt"
import { findAiService, verifiedToolCalls } from "../registry/services"
import type { AiService, OpenAiCompatibleTarget } from "../registry/services"

/**
 * Qwen on Alibaba Model Studio, Singapore region (registry/service-qwen.ts):
 * the shop's own key calls the shared domain with thinking off, the output
 * capped in `max_completion_tokens`, JSON mode and images inline; the
 * connection check is the undocumented model list, so only a 401 refuses.
 */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-qwen-not-a-real-one"
const CHAT_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"

const answer = (status: number, body: unknown): SafeFetchResponse => ({
  status,
  headers: {},
  body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
  url: "https://example.invalid/",
})

const completion = (content: string, finish = "stop") =>
  answer(200, {
    choices: [{ message: { role: "assistant", content }, finish_reason: finish }],
    usage: { prompt_tokens: 90, completion_tokens: 12, total_tokens: 102 },
  })

function qwen(capability: "text" | "vision"): {
  service: AiService
  target: OpenAiCompatibleTarget
} {
  const service = findAiService("qwen", "production")
  const target = service?.capabilities[capability]
  if (!service || target?.connector !== "openai-compatible") {
    throw new Error(`no qwen ${capability} target`)
  }
  return { service, target }
}

function recorder(step: SafeFetchResponse) {
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const fetch = (input: URL | string, options?: SafeFetchOptions) => {
    calls.push({ url: String(input), options: options ?? {} })
    return Promise.resolve(step)
  }
  return { calls, fetch }
}

const bodyOf = (calls: { options: SafeFetchOptions }[]) =>
  JSON.parse(String(calls[0]?.options.body)) as Record<string, unknown>

const REQUEST = { system: DATA_RULE, data: '{"data":{"name":"Keten Gömlek"}}', maxTokens: 200 }

describe("Qwen (Alibaba Model Studio, Singapore)", () => {
  it("is registered for text and image reading on the Singapore domain alone", () => {
    const { service } = qwen("text")
    expect(service).toMatchObject({
      credentialProvider: "qwen",
      funding: "own_key",
      hosts: ["dashscope-intl.aliyuncs.com"],
      downloadHosts: [],
      dataNoteKey: "ai.data_note.qwen",
    })
    expect(Object.keys(service.capabilities)).toEqual(["text", "vision"])
    expect(aiTargetUncapped("qwen", "text")).toBe(false)
    expect(aiTargetUncapped("qwen", "vision")).toBe(false)
  })

  it("sends thinking off, the cap in `max_completion_tokens` and JSON mode", async () => {
    const { calls, fetch } = recorder(completion('{"title":"Keten Gömlek"}'))
    const connector = openAiCompatibleText({ ...qwen("text"), apiKey: KEY, fetch })

    const result = await connector.complete({ ...REQUEST, json: true, temperature: 1.5 })

    expect(result.text).toBe('{"title":"Keten Gömlek"}')
    expect(calls[0]?.url).toBe(CHAT_URL)
    expect(calls[0]?.options.headers).toMatchObject({ Authorization: `Bearer ${KEY}` })
    const body = bodyOf(calls)
    expect(body).toEqual({
      enable_thinking: false,
      model: "qwen3.8-flash",
      messages: [
        { role: "system", content: DATA_RULE },
        { role: "user", content: REQUEST.data },
      ],
      stream: false,
      max_completion_tokens: 200,
      response_format: { type: "json_object" },
    })
    // The temperature range ends below 2 here: not sent at all
    expect(body).not.toHaveProperty("temperature")
    expect(JSON.stringify(body)).not.toContain(KEY)
  })

  it("asks only where the word JSON is in the messages, as JSON mode requires", () => {
    expect(DATA_RULE).toContain("JSON")
    expect(DATA_LAST).toContain("JSON")
  })

  it("refuses a JSON answer cut short at the output cap", async () => {
    const cut = '{"title":"Keten Gömlek","attributes":{"material":"steel"},"short_descr'
    const { fetch } = recorder(completion(cut, "length"))
    const connector = openAiCompatibleText({ ...qwen("text"), apiKey: KEY, fetch })

    const { text } = await connector.complete({ ...REQUEST, json: true })

    expect(jsonObjectOf(text)).toBeNull()
    expect(productCardOf(text, { categories: [], attributes: [] })).toEqual({
      problems: ["format"],
    })
  })

  it("sends an image as a base64 data URL with thinking off", async () => {
    const { calls, fetch } = recorder(completion("Beyaz kupa"))
    const connector = openAiCompatibleText({ ...qwen("vision"), apiKey: KEY, fetch })
    const jpeg = { mimeType: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]) }

    await connector.complete({ ...REQUEST, images: [jpeg] })

    expect(calls[0]?.url).toBe(CHAT_URL)
    const body = bodyOf(calls)
    expect(body).toMatchObject({ enable_thinking: false, model: "qwen3.8-flash" })
    expect((body["messages"] as unknown[])[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: REQUEST.data },
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${jpeg.bytes.toString("base64")}` },
        },
      ],
    })
  })

  it("is open to the assistant, with `tool_choice: auto` and never `required`", async () => {
    expect(verifiedToolCalls(qwen("text").service)).toMatchObject({
      verified: true,
      toolChoice: true,
    })
    const { calls, fetch } = recorder(completion("Kargo ayarları Teslimat sayfasındadır."))
    const connector = openAiCompatibleTools({ ...qwen("text"), apiKey: KEY, fetch })

    await connector.converse({
      messages: [
        { role: "system", content: "Rules." },
        { role: "user", content: "kargo" },
      ],
      tools: [{ name: "find_screen", description: "Find a screen.", parameters: {} }],
      maxTokens: 300,
    })

    expect(bodyOf(calls)).toMatchObject({
      enable_thinking: false,
      tool_choice: "auto",
      max_completion_tokens: 300,
    })
  })
})

describe("Qwen's connection check", () => {
  let warn: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    warn.mockRestore()
  })

  const check = (step: SafeFetchResponse) => {
    const { calls, fetch } = recorder(step)
    return {
      calls,
      result: checkAiAccount("qwen", KEY, AbortSignal.timeout(5_000), { fetch, nodeEnv: "test" }),
    }
  }

  it("asks the model list with the key in the header alone", async () => {
    const { calls, result } = check(answer(200, { object: "list", data: [] }))
    expect(await result).toBe("valid")
    expect(calls[0]?.url).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models")
    expect(calls[0]?.options).toMatchObject({ method: "GET", redirect: "error" })
    expect(calls[0]?.options.headers).toMatchObject({ Authorization: `Bearer ${KEY}` })
  })

  it("refuses the key on a 401 only: the list is not documented", async () => {
    expect(await check(answer(401, "invalid_api_key")).result).toBe("secret_invalid")
    // A 403 may be an overdue account or a model the key may not call; a 404, no list
    expect(await check(answer(403, "Arrearage")).result).toBe("unreachable")
    expect(await check(answer(404, "")).result).toBe("unreachable")
    expect(replacesUnchecked("qwen")).toBe(true)
  })
})
