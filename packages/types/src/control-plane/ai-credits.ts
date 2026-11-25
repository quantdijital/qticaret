import { z } from "zod"

/**
 * The AI platform credits (adr/0085): what a task costs, how many provider
 * calls one operation may make, and the shapes of the control plane's
 * gateway routes a shop calls with a signed request. Data and schemas
 * only. The gateway reads its own copy of the table (K4): a shop names the
 * task, never the price. A unit test in the shop holds its task registry
 * to this table.
 */

/** Credits per operation (adr/0085 "Kredi tablosu"); a task left out does not run on credits. */
export const AI_TASK_CREDITS = Object.freeze({
  // Short text: 1
  seo_title: 1,
  seo_description: 1,
  focus_keyword: 1,
  product_title: 1,
  short_description: 1,
  product_tags: 1,
  product_category: 1,
  product_attributes: 1,
  category_description: 1,
  collection_description: 1,
  brand_description: 1,
  review_reply: 1,
  question_answer: 1,
  campaign_sms: 1,
  // Long text: 2
  product_description: 2,
  product_faq: 2,
  review_summary: 2,
  campaign_email: 2,
  // A blog post's draft
  post_draft: 4,
  // Pictures read
  image_alt_text: 2,
  product_from_photo: 3,
  // The panel assistant's turn (a loop of a few calls)
  assistant: 3,
  // Pictures edited
  image_background: 10,
  image_scene: 40,
} as const satisfies Record<string, number>)

export type AiCreditTask = keyof typeof AI_TASK_CREDITS
export const AI_CREDIT_TASKS = Object.keys(AI_TASK_CREDITS) as readonly AiCreditTask[]

/** The shop's tasks kept off the credits on purpose, each with why. */
export const AI_TASKS_WITHOUT_CREDITS = Object.freeze({
  // adr/0085 K10: a shopper's search would spend the wallet unforeseeably; own key only
  search_intent: "storefront_search",
  // The "test the connection" call of a shop's own key; the platform's needs none
  test_text: "connection_check",
} as const)

export const isAiCreditTask = (task: string): task is AiCreditTask =>
  Object.hasOwn(AI_TASK_CREDITS, task)

/** The capabilities a call on credits can run as (adr/0071 §2); generation and video are not sold. */
export const AI_CREDIT_CAPABILITIES = ["text", "vision", "image_edit"] as const
export type AiCreditCapability = (typeof AI_CREDIT_CAPABILITIES)[number]

/**
 * What each task may call as: its own capability first; a task that may
 * send a picture runs as `vision` too (the shop's `runsAs`). The gateway
 * refuses any other (`task_mismatch`): a cheap task's name never buys a
 * dear call.
 */
export const AI_TASK_CAPABILITIES: Readonly<Record<AiCreditTask, readonly AiCreditCapability[]>> =
  Object.freeze({
    seo_title: ["text"],
    seo_description: ["text"],
    focus_keyword: ["text"],
    product_title: ["text"],
    short_description: ["text"],
    product_tags: ["text"],
    product_category: ["text"],
    product_attributes: ["text", "vision"],
    category_description: ["text"],
    collection_description: ["text"],
    brand_description: ["text"],
    review_reply: ["text"],
    question_answer: ["text"],
    campaign_sms: ["text"],
    product_description: ["text"],
    product_faq: ["text"],
    review_summary: ["text"],
    campaign_email: ["text"],
    post_draft: ["text"],
    image_alt_text: ["vision"],
    product_from_photo: ["vision"],
    assistant: ["text"],
    image_background: ["image_edit"],
    image_scene: ["image_edit"],
  })

/**
 * Provider calls one operation may make (adr/0085 K3): its correction call
 * and one "Yeniden dene" after the gate ride on the same charge. Text and
 * pictures read 3, a picture edited 2; the assistant's turn is a tool loop: 8.
 */
export const AI_CALLS_PER_OPERATION = Object.freeze({
  text: 3,
  vision: 3,
  image_edit: 2,
  assistant: 8,
} as const satisfies Record<AiCreditCapability | "assistant", number>)

/** The calls a task's operation may make. */
export const aiCallCap = (task: AiCreditTask): number =>
  task === "assistant"
    ? AI_CALLS_PER_OPERATION.assistant
    : Math.max(...AI_TASK_CAPABILITIES[task].map((each) => AI_CALLS_PER_OPERATION[each]))

/** How long an operation takes calls after its first (adr/0085 §2). */
export const AI_OPERATION_TTL_SECONDS = 10 * 60

export const AI_CREDIT_CURRENCY = "TRY"

// A Postgres integer at most: a larger number is a refused answer, not an overflow
const AI_CREDIT_MAX = 2_147_483_647
const credits = z.int().min(0).max(AI_CREDIT_MAX)

// Control and invisible format characters never reach a shop's panel
const PLAIN_LINE = /^[^\p{Cc}\p{Cf}\p{Zl}\p{Zp}]*$/u

/**
 * Names as they travel. A shop reads a task or capability it does not
 * know as a shape, not a refusal: the gateway's table may be newer than
 * the shop (a key it does not know is ignored there, like a platform flag).
 */
export const aiTaskNameSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/, "must be a task name")
export const aiCapabilityNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,31}$/, "must be a capability name")
/** A service's id in the shop's registry (`deepseek`, `photoroom`). */
export const aiServiceIdSchema = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "must be a service id")
/** The operation's id: a UUID the shop makes, one per operation. */
export const aiOperationIdSchema = z.uuid()

/** A top-up pack as the platform sells it (K11, K12): name, credits, price in kuruş. */
export const aiCreditPackSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, "must be a pack id"),
  name: z.string().min(1).max(100).regex(PLAIN_LINE),
  credits: credits.min(1),
  amount: z.int().min(0).max(100_000_000),
  currency: z.literal(AI_CREDIT_CURRENCY),
})
export type AiCreditPack = z.infer<typeof aiCreditPackSchema>

export const AI_CREDIT_ORDER_STATUSES = ["pending", "paid", "cancelled"] as const
export type AiCreditOrderStatus = (typeof AI_CREDIT_ORDER_STATUSES)[number]

/** A top-up request (K11): the pack as it was asked for; staff mark it paid. */
export const aiCreditOrderSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_]{1,64}$/, "must be an order id"),
  pack: aiCreditPackSchema,
  status: z.enum(AI_CREDIT_ORDER_STATUSES),
  requested_at: z.iso.datetime(),
})
export type AiCreditOrder = z.infer<typeof aiCreditOrderSchema>

/** The paths of the gateway's tenant routes (`TENANT_API_ROUTES` lists them with P3). */
export const AI_CREDITS_PATHS = {
  credits: "/tenant-api/v1/ai/credits",
  calls: "/tenant-api/v1/ai/calls",
  orders: "/tenant-api/v1/ai/orders",
} as const

/**
 * `GET …/ai/credits`: whether the platform's credits can be used now and,
 * if so, the wallet, the day's cap, the service behind each capability
 * (for the shop's server to build the body; never shown in its panel), the
 * table, the packs and the open request. Unavailable (flag off, no key, no
 * routing) it says only that: the shop shows nothing of the credits.
 */
export const aiCreditsStatusSchema = z.discriminatedUnion("available", [
  z.strictObject({ available: z.literal(false) }),
  z.strictObject({
    available: z.literal(true),
    balance: z.strictObject({
      /** This month's grant left (K5) and the Istanbul day it renews. */
      plan: z.strictObject({ remaining: credits, renews_on: z.iso.date() }),
      /** Bought credits left (K6) and their last day; null while none were bought. */
      purchased: z.strictObject({ remaining: credits, expires_on: z.iso.date().nullable() }),
    }),
    /** The day's cap (K7) and what is left of it today. */
    daily: z.strictObject({ cap: credits, remaining: credits }),
    services: z
      .record(aiCapabilityNameSchema, aiServiceIdSchema)
      .refine((value) => Object.keys(value).length <= 10, "has too many capabilities"),
    /** The gateway's own table (K4): what each task costs now. */
    table: z
      .record(aiTaskNameSchema, credits.min(1))
      .refine((value) => Object.keys(value).length <= 200, "has too many tasks"),
    packs: z.array(aiCreditPackSchema).max(20),
    pending_order: aiCreditOrderSchema.nullable(),
  }),
])
export type AiCreditsStatus = z.infer<typeof aiCreditsStatusSchema>

/** The status answer is held to this before it is parsed. */
export const AI_CREDITS_STATUS_MAX_BYTES = 16 * 1024

/** `POST …/ai/calls`' own headers, lowercase as Node holds them; the body is the provider's. */
export const AI_CALL_HEADERS = {
  task: "x-qt-ai-task",
  capability: "x-qt-ai-capability",
  service: "x-qt-ai-service",
  operation: "x-qt-ai-operation",
} as const

export const aiCallHeadersSchema = z.strictObject({
  [AI_CALL_HEADERS.task]: aiTaskNameSchema,
  [AI_CALL_HEADERS.capability]: aiCapabilityNameSchema,
  [AI_CALL_HEADERS.service]: aiServiceIdSchema,
  [AI_CALL_HEADERS.operation]: aiOperationIdSchema,
})
export type AiCallHeaders = z.infer<typeof aiCallHeadersSchema>

/**
 * The gateway's headers on a call's answer: the credits this call charged
 * (0 for a later call of the same operation) and the wallet left after it.
 * `refusal` marks the gateway's own refusal apart from a provider's answer,
 * which passes as it came.
 */
export const AI_CALL_RESPONSE_HEADERS = {
  charged: "x-qt-ai-credits-charged",
  balance: "x-qt-ai-credits-balance",
  refusal: "x-qt-ai-refusal",
} as const

const headerCount = z
  .string()
  .regex(/^(?:0|[1-9][0-9]{0,9})$/, "must be a whole number")
  .transform(Number)
  .pipe(credits)

export const aiCallResponseHeadersSchema = z.strictObject({
  [AI_CALL_RESPONSE_HEADERS.charged]: headerCount,
  [AI_CALL_RESPONSE_HEADERS.balance]: headerCount,
})
export type AiCallResponseHeaders = z.infer<typeof aiCallResponseHeadersSchema>

/**
 * Why the gateway refused before any provider was asked, and its status:
 * no credits left, the day's cap reached, credits not available (flag,
 * key or routing; the service named is not the one routed), a capability
 * the task may not call as, the operation's calls used up (or the
 * operation closed), a task not sold on credits, a body the task may not
 * send (a tool outside the assistant, too many pictures, a type the
 * service does not take, more than the task's input), a body over 6 MB.
 */
export const AI_GATEWAY_REFUSALS = Object.freeze({
  credits_exhausted: 402,
  daily_cap: 429,
  unavailable: 503,
  task_mismatch: 422,
  call_cap: 409,
  not_offered: 404,
  body_refused: 400,
  body_too_large: 413,
} as const)
export type AiGatewayRefusalCode = keyof typeof AI_GATEWAY_REFUSALS
export const AI_GATEWAY_REFUSAL_CODES = Object.keys(AI_GATEWAY_REFUSALS) as [
  AiGatewayRefusalCode,
  ...AiGatewayRefusalCode[],
]

/** The refusal's body, sent with the `refusal` header naming the same code. */
export const aiGatewayRefusalSchema = z.strictObject({
  qt_ai_gateway: z.strictObject({ code: z.enum(AI_GATEWAY_REFUSAL_CODES) }),
})
export type AiGatewayRefusal = z.infer<typeof aiGatewayRefusalSchema>

/**
 * Who in the shop asked: the shop user's opaque id (`user_01…`), never an
 * e-mail or a name (a `@` is refused; docs/kvkk-envanter.md).
 */
export const aiCreditRequesterSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, "must be an opaque user id")

/**
 * `POST …/ai/orders`: a pack asked for and who asked; its credits and
 * price are read from the platform's pack, never sent.
 */
export const aiCreditOrderRequestSchema = z.strictObject({
  pack_id: aiCreditPackSchema.shape.id,
  requested_by: aiCreditRequesterSchema,
})
export type AiCreditOrderRequest = z.infer<typeof aiCreditOrderRequestSchema>

/** The request's body is held to this (a pack's id and a user's id). */
export const AI_CREDIT_ORDER_MAX_BYTES = 1024

export const aiCreditOrderResponseSchema = z.strictObject({ order: aiCreditOrderSchema })
export type AiCreditOrderResponse = z.infer<typeof aiCreditOrderResponseSchema>
