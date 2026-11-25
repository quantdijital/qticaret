import { describe, expect, it } from "vitest"
import {
  AI_CALLS_PER_OPERATION,
  AI_CALL_PARAMS,
  AI_CALL_RESPONSE_HEADERS,
  AI_CREDIT_TASKS,
  AI_GATEWAY_REFUSALS,
  AI_GATEWAY_REFUSAL_CODES,
  AI_OPERATION_TTL_SECONDS,
  AI_TASKS_WITHOUT_CREDITS,
  AI_TASK_CAPABILITIES,
  AI_TASK_CREDITS,
  aiCallCap,
  aiCallParamsSchema,
  aiCallPath,
  aiCallResponseHeadersSchema,
  aiCreditOrderRequestSchema,
  aiCreditOrderResponseSchema,
  aiCreditsStatusSchema,
  aiGatewayRefusalSchema,
  isAiCreditTask,
} from "../../control-plane/ai-credits.js"

const PACK = { id: "kredi-500", name: "500 kredi", credits: 500, amount: 25_000, currency: "TRY" }
const ORDER = {
  id: "aicord_01JCP0TEST",
  pack: PACK,
  status: "pending",
  requested_at: "2026-11-25T09:00:00.000Z",
}
const STATUS = {
  available: true,
  balance: {
    plan: { remaining: 120, renews_on: "2026-12-01" },
    purchased: { remaining: 500, expires_on: "2027-11-25" },
  },
  daily: { cap: 300, remaining: 260 },
  services: { text: "deepseek", vision: "gemini", image_edit: "photoroom" },
  table: { seo_title: 1, image_scene: 40 },
  packs: [PACK],
  pending_order: ORDER,
}

describe("the credit table (adr/0085)", () => {
  it("prices every task a whole number of credits, at least 1, as the ADR's groups say", () => {
    for (const task of AI_CREDIT_TASKS) {
      expect(Number.isSafeInteger(AI_TASK_CREDITS[task]) && AI_TASK_CREDITS[task] >= 1).toBe(true)
    }
    expect(AI_TASK_CREDITS).toMatchObject({
      seo_title: 1,
      product_description: 2,
      post_draft: 4,
      image_alt_text: 2,
      product_from_photo: 3,
      assistant: 3,
      image_background: 10,
      image_scene: 40,
    })
  })

  it("keeps the storefront search and the connection check off the credits, and only off", () => {
    expect(Object.keys(AI_TASKS_WITHOUT_CREDITS).sort()).toEqual(["search_intent", "test_text"])
    for (const task of Object.keys(AI_TASKS_WITHOUT_CREDITS)) {
      expect(isAiCreditTask(task)).toBe(false)
    }
    expect(isAiCreditTask("seo_title")).toBe(true)
    expect(isAiCreditTask("__proto__")).toBe(false)
  })

  it("gives every task its capabilities and a call cap per operation", () => {
    expect(Object.keys(AI_TASK_CAPABILITIES).sort()).toEqual([...AI_CREDIT_TASKS].sort())
    expect(AI_TASK_CAPABILITIES.product_attributes).toEqual(["text", "vision"])
    expect(aiCallCap("seo_title")).toBe(AI_CALLS_PER_OPERATION.text)
    expect(aiCallCap("image_alt_text")).toBe(3)
    expect(aiCallCap("image_scene")).toBe(2)
    expect(aiCallCap("assistant")).toBe(8)
    expect(AI_OPERATION_TTL_SECONDS).toBe(600)
  })
})

describe("the gateway's shapes", () => {
  it("reads a status, available or not, and nothing more when not", () => {
    expect(aiCreditsStatusSchema.parse(STATUS)).toEqual(STATUS)
    expect(aiCreditsStatusSchema.parse({ available: false })).toEqual({ available: false })
    expect(aiCreditsStatusSchema.safeParse({ available: false, packs: [] }).success).toBe(false)
    const unbought = {
      ...STATUS,
      balance: { ...STATUS.balance, purchased: { remaining: 0, expires_on: null } },
      pending_order: null,
    }
    expect(aiCreditsStatusSchema.safeParse(unbought).success).toBe(true)
  })

  it.each([
    ["an unknown field", { ...STATUS, wallet_id: "x" }],
    ["a negative balance", { ...STATUS, daily: { cap: 300, remaining: -1 } }],
    ["a fractional price", { ...STATUS, packs: [{ ...PACK, amount: 10.5 }] }],
    ["another currency", { ...STATUS, packs: [{ ...PACK, currency: "USD" }] }],
    ["a task of 0 credits", { ...STATUS, table: { seo_title: 0 } }],
    ["a service id that is not one", { ...STATUS, services: { text: "https://x" } }],
  ])("refuses a status with %s", (_case, status) => {
    expect(aiCreditsStatusSchema.safeParse(status).success).toBe(false)
  })

  it("takes a task the shop does not know yet in the gateway's table", () => {
    const newer = { ...STATUS, table: { ...STATUS.table, video_clip: 80 } }
    expect(aiCreditsStatusSchema.safeParse(newer).success).toBe(true)
  })

  it("holds a call's query to its rules", () => {
    const params = {
      [AI_CALL_PARAMS.task]: "product_description",
      [AI_CALL_PARAMS.capability]: "text",
      [AI_CALL_PARAMS.service]: "deepseek",
      [AI_CALL_PARAMS.operation]: "3f0e8a52-6b1d-4c7e-9a43-2d5b8f1c0e97",
    }
    expect(aiCallParamsSchema.parse(params)).toEqual(params)
    for (const [name, value] of [
      [AI_CALL_PARAMS.operation, "op-1"],
      [AI_CALL_PARAMS.task, "Product Description"],
      [AI_CALL_PARAMS.service, "../deepseek"],
      // A repeated parameter, read as a list
      [AI_CALL_PARAMS.task, ["seo_title", "post_draft"]],
    ] as const) {
      expect(aiCallParamsSchema.safeParse({ ...params, [name]: value }).success).toBe(false)
    }
    expect(aiCallParamsSchema.safeParse({ ...params, model: "big" }).success).toBe(false)
    expect(aiCallParamsSchema.safeParse({ ...params, service: undefined }).success).toBe(false)
  })

  it("writes a call's target with its four values in a fixed order", () => {
    const path = aiCallPath({
      task: "seo_title",
      capability: "text",
      service: "deepseek",
      operation: "3f0e8a52-6b1d-4c7e-9a43-2d5b8f1c0e97",
    })
    expect(path).toBe(
      "/tenant-api/v1/ai/calls?task=seo_title&capability=text&service=deepseek&operation=3f0e8a52-6b1d-4c7e-9a43-2d5b8f1c0e97"
    )
  })

  it("reads the charged credits and the balance from an answer's headers", () => {
    const parsed = aiCallResponseHeadersSchema.parse({
      [AI_CALL_RESPONSE_HEADERS.charged]: "0",
      [AI_CALL_RESPONSE_HEADERS.balance]: "620",
    })
    expect(parsed).toEqual({
      [AI_CALL_RESPONSE_HEADERS.charged]: 0,
      [AI_CALL_RESPONSE_HEADERS.balance]: 620,
    })
    for (const value of ["-1", "1.5", "01", "", "1e3"]) {
      expect(
        aiCallResponseHeadersSchema.safeParse({
          [AI_CALL_RESPONSE_HEADERS.charged]: value,
          [AI_CALL_RESPONSE_HEADERS.balance]: "1",
        }).success
      ).toBe(false)
    }
  })

  it("gives each refusal its own envelope and an error status", () => {
    expect([...AI_GATEWAY_REFUSAL_CODES].sort()).toEqual([
      "body_refused",
      "body_too_large",
      "call_cap",
      "credits_exhausted",
      "daily_cap",
      "not_offered",
      "provider_timeout",
      "provider_unreachable",
      "task_mismatch",
      "unavailable",
    ])
    // A provider's 4xx and the gateway's own are told apart by the header, not the status
    expect(AI_GATEWAY_REFUSALS.body_too_large).toBe(413)
    expect(AI_GATEWAY_REFUSALS.credits_exhausted).toBe(402)
    for (const code of AI_GATEWAY_REFUSAL_CODES) {
      expect(AI_GATEWAY_REFUSALS[code]).toBeGreaterThanOrEqual(400)
      expect(aiGatewayRefusalSchema.parse({ qt_ai_gateway: { code } })).toEqual({
        qt_ai_gateway: { code },
      })
    }
    expect(aiGatewayRefusalSchema.safeParse({ qt_ai_gateway: { code: "nope" } }).success).toBe(
      false
    )
  })

  it("asks for a pack by its id only; the answer is the order as it stands", () => {
    const asked = { pack_id: "kredi-500", requested_by: "user_01JABCDEF" }
    expect(aiCreditOrderRequestSchema.parse(asked)).toEqual(asked)
    for (const body of [
      { ...asked, amount: 1 },
      { ...asked, credits: 500 },
      { pack_id: "kredi-500" },
      { ...asked, requested_by: "selin@example.com" },
      { ...asked, requested_by: "Selin Aydın" },
      { ...asked, requested_by: "" },
    ]) {
      expect(aiCreditOrderRequestSchema.safeParse(body).success).toBe(false)
    }
    expect(aiCreditOrderResponseSchema.parse({ order: ORDER })).toEqual({ order: ORDER })
    expect(
      aiCreditOrderResponseSchema.safeParse({ order: { ...ORDER, status: "refunded" } }).success
    ).toBe(false)
  })
})
