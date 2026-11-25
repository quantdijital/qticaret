import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import { gatewayTargetOf } from "../target"
import type { GatewayTarget } from "../target"

/**
 * The allow-list (security review of P3b C1): what costs money and is not
 * the prompt never reaches a provider, whatever a shop writes; a body
 * nested past what can be written back is refused, never a 500.
 */

const target = (service: string, capability: AiCreditCapability, task: AiCreditTask) => {
  const found = gatewayTargetOf(service, capability, task)
  if (found === null) {
    throw new Error(`no target ${service} ${capability}`)
  }
  return found
}

const DEEPSEEK = target("deepseek", "text", "seo_title")
const MINIMAX = target("minimax", "text", "seo_title")
const GEMINI_IMAGE = target("gemini", "image_edit", "image_background")

const send = (
  body: unknown,
  to: GatewayTarget = DEEPSEEK,
  task: AiCreditTask = "seo_title",
  capability: AiCreditCapability = "text"
) =>
  prepareBody({
    raw: Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    task,
    capability,
    target: to,
  })

const sent = (result: ReturnType<typeof prepareBody>): Record<string, unknown> => {
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`)
  }
  return JSON.parse(result.body.toString("utf8")) as Record<string, unknown>
}

// Fields a provider bills for, searches with, keeps or answers many times with
const COSTLY = {
  reasoning_effort: "high",
  extra_body: { google: { thinking_config: { thinking_budget: 24_576 } }, cached_content: "c" },
  service_tier: "priority",
  store: true,
  web_search_options: {},
  modalities: ["text", "audio"],
  audio: { voice: "x" },
  n: 4,
  logprobs: true,
  top_logprobs: 20,
  prediction: { type: "content", content: "x" },
  metadata: { a: "b" },
  thinking: { type: "enabled", budget_tokens: 32_000 },
  reasoning_split: false,
  parallel_tool_calls: true,
  user: "u",
  seed: 1,
}

const chat = (extra: Record<string, unknown> = {}) => ({
  model: "gpt-dear-9",
  messages: [
    { role: "system", content: "s", name: "x", cache_control: { type: "ephemeral" } },
    {
      role: "user",
      content: [
        { type: "text", text: "u", cache_control: { type: "ephemeral" } },
        { type: "image_url", image_url: { url: "data:image/png;base64,AA", detail: "high" } },
      ],
    },
  ],
  max_tokens: 99_999,
  ...extra,
})

describe("the allow-list the gateway rebuilds a body from (P3b review C1)", () => {
  it("drops every costly field a shop wrote and writes the target's fixed ones", () => {
    const vision = target("deepseek", "vision", "image_alt_text")
    const body = sent(send(chat(COSTLY), vision, "image_alt_text", "vision"))
    expect(body).toEqual({
      thinking: { type: "disabled" },
      model: "deepseek-flash",
      messages: [
        { role: "system", content: "s" },
        {
          role: "user",
          content: [
            { type: "text", text: "u" },
            { type: "image_url", image_url: { url: "data:image/png;base64,AA" } },
          ],
        },
      ],
      stream: false,
      max_tokens: 250,
    })
    const minimax = sent(
      send(chat({ ...COSTLY, messages: [{ role: "user", content: "u" }] }), MINIMAX)
    )
    expect(minimax).toEqual({
      reasoning_split: true,
      reasoning_effort: "low",
      model: "MiniMax-M3.1-Flash",
      messages: [{ role: "user", content: "u" }],
      stream: false,
      max_completion_tokens: 360,
    })
  })

  it("keeps a JSON or text answer format and a temperature from 0 to 2, nothing else", () => {
    const user = { messages: [{ role: "user", content: "u" }] }
    expect(
      sent(send({ ...user, response_format: { type: "json_object" }, temperature: 0.2 }))
    ).toMatchObject({ response_format: { type: "json_object" }, temperature: 0.2 })
    const dropped = sent(
      send({ ...user, response_format: { type: "json_schema", json_schema: {} }, temperature: 9 })
    )
    expect(dropped).not.toHaveProperty("response_format")
    expect(dropped).not.toHaveProperty("temperature")
  })

  it("takes a tool's turn only on the assistant's call", () => {
    const toolTurn = {
      messages: [
        { role: "user", content: "u" },
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "1", type: "function", function: { name: "f", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "1", content: "[]" },
      ],
    }
    expect(send(toolTurn)).toMatchObject({ ok: false, reason: "tools_not_allowed" })
    expect(send(toolTurn, DEEPSEEK, "assistant")).toMatchObject({ ok: true })
    // A tool that is not a function (a provider's own search) is refused
    const search = { ...toolTurn, tools: [{ type: "web_search" }] }
    expect(send(search, DEEPSEEK, "assistant")).toMatchObject({ ok: false, reason: "tool_refused" })
    expect(send({ messages: [{ role: "developer", content: "x" }] })).toMatchObject({ ok: false })
  })

  it("rebuilds a Gemini picture body: its parts, and the target's generation config", () => {
    const edit = (extra: Record<string, unknown>, parts: unknown[] = []) =>
      send(
        {
          contents: [
            {
              role: "user",
              parts: [
                { text: "t" },
                { inlineData: { mimeType: "image/png", data: "AA" } },
                ...parts,
              ],
            },
          ],
          ...extra,
        },
        GEMINI_IMAGE,
        "image_background",
        "image_edit"
      )
    const body = sent(
      edit({
        model: "gemini-pro-dear",
        generationConfig: {
          maxOutputTokens: 65_536,
          thinkingConfig: { thinkingBudget: 24_576 },
          imageConfig: { imageSize: "4K" },
          responseModalities: ["TEXT", "IMAGE"],
          candidateCount: 8,
        },
        generation_config: { candidate_count: 8 },
        systemInstruction: { parts: [{ text: "x".repeat(1_000) }] },
        cachedContent: "cachedContents/x",
        safetySettings: [],
      })
    )
    expect(body).toEqual({
      contents: [
        {
          role: "user",
          parts: [{ text: "t" }, { inlineData: { mimeType: "image/png", data: "AA" } }],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"], candidateCount: 1 },
    })
    expect(edit({}, [{ functionCall: { name: "f" } }])).toMatchObject({
      ok: false,
      reason: "part_refused",
    })
    expect(edit({}, [{ fileData: { fileUri: "gs://x" } }])).toMatchObject({
      ok: false,
      reason: "image_not_inline",
    })
  })

  it("refuses a body nested past what can be written back, never throws", () => {
    const depth = 120_000
    const deep = `${"[".repeat(depth)}${"]".repeat(depth)}`
    const assistant = Buffer.from(
      `{"messages":[{"role":"user","content":"u"}],"tools":[{"type":"function","function":{"name":"f","parameters":{"d":${deep}}}}]}`
    )
    expect(() => send(assistant, DEEPSEEK, "assistant")).not.toThrow()
    expect(send(assistant, DEEPSEEK, "assistant")).toMatchObject({
      ok: false,
      code: "body_refused",
    })
    const parsedDeep = Buffer.from(`{"messages":${deep}}`)
    expect(send(parsedDeep, DEEPSEEK, "assistant")).toMatchObject({
      ok: false,
      code: "body_refused",
    })
  })
})
