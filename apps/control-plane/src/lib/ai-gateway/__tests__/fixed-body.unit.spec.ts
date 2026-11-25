import { AI_SERVICE_TARGETS } from "@qticaret/types/control-plane"
import type { AiServiceTarget } from "@qticaret/types/control-plane"
import { prepareBody } from "../body"
import { chatGatewayFields } from "../body-chat"
import { GEMINI_GATEWAY_FIELDS } from "../body-gemini"
import { AI_TASK_LIMITS } from "../limits"
import { gatewayTargetOf } from "../target"
import type { GatewayTarget } from "../target"

/**
 * Third security review of P3b, D1: a target's fixed fields never write
 * over the ones the gateway writes itself. The table holds none of them,
 * and were one written there, the gateway's own would still win.
 */

/** Every leaf's dotted path in a fixed body (an object is merged into, its leaves written). */
function pathsOf(value: Readonly<Record<string, unknown>>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, inner]) => {
    const path = `${prefix}${key}`
    return inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? pathsOf(inner as Record<string, unknown>, `${path}.`)
      : [path]
  })
}

/** Two paths meet where one is the other or lies within it. */
const meet = (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`)

const target = (service: string, capability: "text" | "image_edit", fixedBody: object) => {
  const found = gatewayTargetOf(
    service,
    capability,
    capability === "text" ? "seo_title" : "image_background"
  )
  if (found === null) {
    throw new Error(`no target ${service} ${capability}`)
  }
  return { ...found, fixedBody: fixedBody as Record<string, unknown> }
}

const sent = (body: unknown, to: GatewayTarget, capability: "text" | "image_edit") => {
  const result = prepareBody({
    raw: Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    task: capability === "text" ? "seo_title" : "image_background",
    capability,
    target: to,
  })
  if (!result.ok) {
    throw new Error(`refused: ${result.reason}`)
  }
  return JSON.parse(result.body.toString("utf8")) as Record<string, unknown>
}

describe("a target's fixed fields and the gateway's own (P3b third review D1)", () => {
  it("holds no table row's fixed field on a field the gateway writes", () => {
    const rows = Object.entries(AI_SERVICE_TARGETS as Record<string, AiServiceTarget>).flatMap(
      ([service, { capabilities }]) =>
        Object.entries(capabilities).map(([capability, row]) => ({ service, capability, row }))
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const { service, capability, row } of rows) {
      const own: readonly string[] =
        row.protocol === "openai-chat"
          ? // No row writes an output budget, whichever field its target caps by
            [
              ...chatGatewayFields(row.maxTokensField ?? null),
              "max_tokens",
              "max_completion_tokens",
            ]
          : row.protocol === "gemini-image"
            ? GEMINI_GATEWAY_FIELDS
            : []
      const clashes = pathsOf(row.fixedBody ?? {}).filter((path) =>
        own.some((field) => meet(path, field))
      )
      expect([service, capability, clashes]).toEqual([service, capability, []])
      if (row.protocol === "photoroom") {
        expect(row.fixedBody).toBeUndefined()
      }
    }
  })

  it("writes the chat's model, messages, stream and output cap over a row that names them", () => {
    const cap = AI_TASK_LIMITS.seo_title.maxOutputTokens
    const row = target("deepseek", "text", {
      max_tokens: 1_000_000,
      model: "a-dearer-model",
      stream: true,
      messages: [{ role: "user", content: "the row's" }],
      thinking: { type: "disabled" },
    })
    const body = sent(
      { messages: [{ role: "user", content: "the shop's" }], max_tokens: 100_000 },
      row,
      "text"
    )
    expect(body).toMatchObject({
      model: row.model,
      stream: false,
      max_tokens: cap,
      messages: [{ role: "user", content: "the shop's" }],
      thinking: { type: "disabled" },
    })
  })

  it("writes the picture's contents and one candidate over a row that names them", () => {
    const row = target("gemini", "image_edit", {
      contents: [{ parts: [{ text: "the row's" }] }],
      generationConfig: { responseModalities: ["IMAGE"], candidateCount: 8 },
    })
    const body = sent({ contents: [{ parts: [{ text: "the shop's" }] }] }, row, "image_edit")
    expect(body).toEqual({
      contents: [{ parts: [{ text: "the shop's" }] }],
      generationConfig: { responseModalities: ["IMAGE"], candidateCount: 1 },
    })
  })
})
