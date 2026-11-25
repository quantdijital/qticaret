import { isProviderError } from "../../errors/errors"
import { logger } from "../../logging"
import type { SafeFetchOptions, SafeFetchResponse } from "../../security/safe-fetch"
import { toolConnectorFor } from "../connector-of"
import { fakeToolConnector } from "../connectors/fake-tools"
import { openAiCompatibleTools, readToolCompletion } from "../connectors/openai-tools"
import type { ConverseRequest } from "../connectors/types"
import { aiServices, findAiService, verifiedToolCalls } from "../registry/services"
import type { AiService, OpenAiCompatibleTarget } from "../registry/services"

/** adr/0079 §2 (Y1-1): tool calling on the shared chat connector, on a `fetch` stand-in. */

// Plainly fake: nothing here has the shape of a real key
const KEY = "test-key-tools-not-a-real-one"

const answer = (status: number, body: unknown): SafeFetchResponse => ({
  status,
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
  url: "https://example.invalid/",
})

function serviceOf(id: string): { service: AiService; target: OpenAiCompatibleTarget } {
  const service = findAiService(id, "test")
  const target = service?.capabilities.text
  if (!service || target?.connector !== "openai-compatible") {
    throw new Error(`no text target for ${id}`)
  }
  return { service, target }
}

function connectorFor(id: string, steps: SafeFetchResponse[]) {
  const calls: { url: string; options: SafeFetchOptions }[] = []
  const connector = openAiCompatibleTools({
    ...serviceOf(id),
    apiKey: KEY,
    fetch: (input, options) => {
      calls.push({ url: String(input), options: options ?? {} })
      const step = steps.shift()
      return step ? Promise.resolve(step) : Promise.reject(new Error("no more answers"))
    },
    wait: () => Promise.resolve(),
  })
  return { connector, calls }
}

const REQUEST: ConverseRequest = {
  messages: [
    { role: "system", content: "Rules." },
    { role: "user", content: "kargo ücreti nereden değişir" },
    {
      role: "assistant",
      content: null,
      toolCalls: [{ id: "call_1", name: "find_screen", arguments: '{"query":"kargo"}' }],
    },
    { role: "tool", toolCallId: "call_1", content: '{"untrusted":true,"data":{"screens":[]}}' },
  ],
  tools: [
    {
      name: "find_screen",
      description: "Find a screen.",
      parameters: { type: "object", properties: { query: { type: "string" } } },
    },
  ],
  maxTokens: 500,
}

const toolAnswer = {
  choices: [
    {
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_2",
            type: "function",
            function: { name: "explain_screen", arguments: '{"key":"settings.shipping"}' },
          },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 80, completion_tokens: 9 },
}

describe("tool calling connector (adr/0079 §2)", () => {
  it("sends tools as functions and the steps in their own roles, the key in the header only", async () => {
    const info = jest.spyOn(logger, "info")
    const { connector, calls } = connectorFor("deepseek", [answer(200, toolAnswer)])

    const result = await connector.converse(REQUEST)

    expect(result).toEqual({
      toolCalls: [
        { id: "call_2", name: "explain_screen", arguments: '{"key":"settings.shipping"}' },
      ],
      usage: { inputTokens: 80, outputTokens: 9 },
    })
    const [{ url, options }] = calls as [(typeof calls)[number]]
    expect(url).toBe("https://api.deepseek.com/chat/completions")
    expect(options.headers).toMatchObject({ Authorization: `Bearer ${KEY}` })
    expect(options.redirect).toBe("error")
    const body = JSON.parse(String(options.body)) as Record<string, unknown>
    expect(body["tools"]).toEqual([
      {
        type: "function",
        function: {
          name: "find_screen",
          description: "Find a screen.",
          parameters: { type: "object", properties: { query: { type: "string" } } },
        },
      },
    ])
    expect(body["messages"]).toEqual([
      { role: "system", content: "Rules." },
      { role: "user", content: "kargo ücreti nereden değişir" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "find_screen", arguments: '{"query":"kargo"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: '{"untrusted":true,"data":{"screens":[]}}' },
    ])
    // DeepSeek's guide names no tool_choice: left to its default
    expect(body).not.toHaveProperty("tool_choice")
    expect(body).not.toHaveProperty("response_format")
    expect(String(options.body)).not.toContain(KEY)
    expect(JSON.stringify(info.mock.calls)).not.toContain(KEY)
    info.mockRestore()
  })

  it("asks for tool_choice auto where the service documents it", async () => {
    const { connector, calls } = connectorFor("gemini", [
      answer(200, { choices: [{ message: { content: "Tamam." } }] }),
    ])
    await expect(connector.converse(REQUEST)).resolves.toEqual({ text: "Tamam.", usage: {} })
    const body = JSON.parse(String(calls[0]?.options.body)) as Record<string, unknown>
    expect(body["tool_choice"]).toBe("auto")
  })

  it("never calls a service whose tool calling is not verified", async () => {
    const { connector, calls } = connectorFor("minimax", [answer(200, toolAnswer)])
    const error: unknown = await connector.converse(REQUEST).catch((thrown: unknown) => thrown)
    expect(isProviderError(error) && error.providerCode).toBe("tools_unverified")
    expect(calls).toHaveLength(0)
    expect(() => toolConnectorFor("minimax", KEY, "test")).toThrow()
  })

  it("maps a refused key without the service's words or the key", async () => {
    const { connector } = connectorFor("deepseek", [
      answer(401, { error: { message: `bad key ${KEY}` } }),
    ])
    const error: unknown = await connector.converse(REQUEST).catch((thrown: unknown) => thrown)
    expect(isProviderError(error) && error.safeMessage).toBe("ai.key_rejected")
    expect(JSON.stringify(error)).not.toContain(KEY)
  })
})

describe("reading a tool calling answer", () => {
  const read = (body: unknown) => readToolCompletion(Buffer.from(JSON.stringify(body)))

  it("takes missing arguments as none and drops a model's thinking", () => {
    expect(
      read({
        choices: [
          {
            message: {
              content: "<think>hmm</think> Bakıyorum.",
              tool_calls: [{ id: "c", function: { name: "find_screen" } }],
            },
          },
        ],
      })
    ).toEqual({
      ok: true,
      result: {
        text: "Bakıyorum.",
        toolCalls: [{ id: "c", name: "find_screen", arguments: "{}" }],
        usage: {},
      },
    })
  })

  it("refuses an answer with neither words nor calls, or a call not shaped as one", () => {
    expect(read({ choices: [{ message: { content: "" } }] })).toMatchObject({
      ok: false,
      code: "empty_content",
    })
    expect(
      read({ choices: [{ message: { tool_calls: [{ id: 1, function: { name: "x" } }] } }] })
    ).toMatchObject({ ok: false, code: "tool_call_invalid" })
    const many = Array.from({ length: 9 }, (_, index) => ({
      id: `c${String(index)}`,
      function: { name: "find_screen", arguments: "{}" },
    }))
    expect(read({ choices: [{ message: { tool_calls: many } }] })).toMatchObject({
      ok: false,
      code: "tool_calls_too_many",
    })
    expect(
      read({ choices: [{ finish_reason: "content_filter", message: { content: "x" } }] })
    ).toMatchObject({ ok: false, key: "ai.content_blocked" })
  })
})

describe("the registry's tool calling records (adr/0079 §2)", () => {
  it("lists the services verified with a date and pages, MiniMax not", () => {
    const verified = aiServices("test")
      .filter((service) => verifiedToolCalls(service) !== null)
      .map((service) => service.id)
    expect(verified).toEqual(["deepseek", "gemini", "qwen", "fake"])
    for (const id of ["deepseek", "gemini", "qwen"]) {
      const support = verifiedToolCalls(serviceOf(id).service)
      expect(support?.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(support?.source.every((page) => page.startsWith("https://"))).toBe(true)
    }
  })

  it("keeps the fake one to tests and development", () => {
    expect(toolConnectorFor("fake", KEY, "test")).toBe(fakeToolConnector)
    expect(() => toolConnectorFor("fake", KEY, "production")).toThrow()
  })
})

describe("the fake service's scenario", () => {
  it("looks the person's words up, then names the first screen found by key", async () => {
    const first = await fakeToolConnector.converse({
      messages: [{ role: "user", content: "kargo ücreti" }],
      tools: REQUEST.tools,
      maxTokens: 100,
    })
    expect(first.toolCalls).toEqual([
      { id: "fake_call_1", name: "find_screen", arguments: '{"query":"kargo ücreti"}' },
    ])
    const second = await fakeToolConnector.converse({
      messages: [
        { role: "user", content: "kargo ücreti" },
        { role: "assistant", content: null, toolCalls: first.toolCalls ?? [] },
        {
          role: "tool",
          toolCallId: "fake_call_1",
          content: JSON.stringify({
            untrusted: true,
            data: { screens: [{ key: "settings.shipping.options" }] },
          }),
        },
      ],
      tools: REQUEST.tools,
      maxTokens: 100,
    })
    expect(second.text).toContain("[[settings.shipping.options]]")
  })
})
