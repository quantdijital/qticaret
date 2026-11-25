import { aiTargetUncapped } from "@qticaret/types/control-plane"
import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import { AI_TASK_LIMITS } from "../limits"
import { gatewayTargetOf } from "../target"
import type { GatewayTarget } from "../target"

/**
 * Qwen on Model Studio's Singapore region: the gateway calls the shared
 * table's address only, caps the output in `max_completion_tokens` and
 * writes `enable_thinking: false` itself (thinking is on by default on
 * qwen3.8-flash); whatever a shop sends for thinking is dropped first.
 */

const target = (capability: AiCreditCapability, task: AiCreditTask): GatewayTarget => {
  const found = gatewayTargetOf("qwen", capability, task)
  if (found === null) {
    throw new Error(`no qwen ${capability} target`)
  }
  return found
}

const sent = (body: unknown, to: GatewayTarget, task: AiCreditTask, capability = "text") => {
  const result = prepareBody({
    raw: Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    task,
    capability: capability as AiCreditCapability,
    target: to,
  })
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`)
  }
  return JSON.parse(result.body.toString("utf8")) as Record<string, unknown>
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64")

describe("the Qwen target", () => {
  it("is routable on credits: Singapore's shared domain, an output cap, a price", () => {
    expect(aiTargetUncapped("qwen", "text")).toBe(false)
    expect(aiTargetUncapped("qwen", "vision")).toBe(false)
    for (const [capability, task] of [
      ["text", "seo_title"],
      ["vision", "image_alt_text"],
    ] as const) {
      expect(target(capability, task)).toMatchObject({
        model: "qwen3.8-flash",
        protocol: "openai-chat",
        auth: "bearer",
        maxTokensField: "max_completion_tokens",
        fixedBody: { enable_thinking: false },
        price: { currency: "USD", inputPerMillionTokens: 150_000, outputPerMillionTokens: 470_000 },
      })
      expect(target(capability, task).url.href).toBe(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
      )
    }
    expect(gatewayTargetOf("qwen", "image_edit", "image_background")).toBeNull()
  })

  it("writes thinking off itself, over anything a shop sends for it", () => {
    const body = sent(
      {
        messages: [{ role: "user", content: "JSON" }],
        enable_thinking: true,
        thinking_budget: 32_000,
        extra_body: { enable_thinking: true },
        max_tokens: 100_000,
        max_completion_tokens: 100_000,
        response_format: { type: "json_object" },
      },
      target("text", "seo_title"),
      "seo_title"
    )
    expect(body).toEqual({
      model: "qwen3.8-flash",
      messages: [{ role: "user", content: "JSON" }],
      stream: false,
      max_completion_tokens: AI_TASK_LIMITS.seo_title.maxOutputTokens,
      response_format: { type: "json_object" },
      enable_thinking: false,
    })
  })

  it("drops a JSON schema answer format (not offered in Singapore)", () => {
    const body = sent(
      {
        messages: [{ role: "user", content: "JSON" }],
        response_format: { type: "json_schema", json_schema: { name: "x", schema: {} } },
      },
      target("text", "seo_title"),
      "seo_title"
    )
    expect(body).not.toHaveProperty("response_format")
  })

  it("passes `tool_choice: auto` on the assistant's turn and drops `required`", () => {
    const tools = [{ type: "function", function: { name: "find", parameters: {} } }]
    const messages = [{ role: "user", content: "hi" }]
    const to = target("text", "assistant")
    expect(sent({ messages, tools, tool_choice: "auto" }, to, "assistant")).toMatchObject({
      tool_choice: "auto",
      enable_thinking: false,
    })
    expect(sent({ messages, tools, tool_choice: "required" }, to, "assistant")).not.toHaveProperty(
      "tool_choice"
    )
  })

  it("takes a picture inline only, never an address", () => {
    const to = target("vision", "image_alt_text")
    const inline = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "JSON" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${PNG}` } },
          ],
        },
      ],
    }
    expect(sent(inline, to, "image_alt_text", "vision")).toMatchObject({
      enable_thinking: false,
      max_completion_tokens: AI_TASK_LIMITS.image_alt_text.maxOutputTokens,
    })
    const remote = prepareBody({
      raw: Buffer.from(
        JSON.stringify({
          messages: [
            {
              role: "user",
              content: [{ type: "image_url", image_url: { url: "https://shop.example/a.png" } }],
            },
          ],
        })
      ),
      contentType: "application/json",
      task: "image_alt_text",
      capability: "vision",
      target: to,
    })
    expect(remote).toMatchObject({ ok: false, reason: "image_not_inline" })
  })
})
