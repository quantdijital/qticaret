import { signRequest } from "@qticaret/server-kit"
import {
  AI_CREDITS_PATHS,
  AI_CREDIT_ORDER_MAX_BYTES,
  aiCreditOrderRequestSchema,
  aiCreditOrderResponseSchema,
} from "@qticaret/types/control-plane"
import type { AiCreditOrder } from "@qticaret/types/control-plane"
import { errorSummary, logger } from "../logging"
import { aiGatewayEndpoint } from "./ai-gateway"
import type { AiGatewayEndpoint } from "./ai-gateway"
import { readCapped } from "./pull"
import type { Fetch } from "./pull"

/**
 * A top-up request for the platform's AI credits (adr/0085 K11):
 * `POST /tenant-api/v1/ai/orders`, signed as the pull is (Ek C9): plain
 * `fetch` to the control plane, no redirect, ten seconds, the answer's
 * bytes capped, never sent twice (a signed request's nonce is single use).
 * The body is the pack's id and the asking user's opaque id, nothing
 * else: the pack's credits and price are the platform's. The control
 * plane's two conflicts it says by key; anything else, the control plane
 * unreachable or unconfigured, is "unavailable", by a code of ours.
 */

const ORDER_TIMEOUT_MS = 10_000
// One order and its pack: far below this
const ORDER_ANSWER_MAX_BYTES = 8 * 1024

/** The control plane's own words for its two conflicts (its `ai-conflicts.ts`, `tenant.ts`). */
const OPEN_ORDER = { status: 409, message: "cp.ai_credit_order_pending" } as const
const UNKNOWN_PACK = { status: 404, message: "ai_credits.pack_unknown" } as const

export type AiCreditOrderResult =
  | { kind: "ordered"; order: AiCreditOrder }
  | { kind: "open" }
  | { kind: "pack_unknown" }
  | { kind: "unavailable"; code: string }

export interface AiCreditOrderInput {
  packId: string
  /** The shop user's id (`user_01…`); never an e-mail or a name. */
  requestedBy: string
}

export interface AiCreditOrderOptions {
  /** Tests only: where and how to sign; the shop's configuration otherwise. */
  endpoint?: AiGatewayEndpoint | null | undefined
  fetch?: Fetch | undefined
  now?: (() => number) | undefined
}

const unavailable = (code: string): AiCreditOrderResult => ({ kind: "unavailable", code })

function messageOf(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text)
    const message = (parsed as { message?: unknown } | null)?.message
    return typeof message === "string" ? message : null
  } catch {
    return null
  }
}

function answerOf(status: number, text: string): AiCreditOrderResult {
  if (status === 201) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return unavailable("answer_not_json")
    }
    const answer = aiCreditOrderResponseSchema.safeParse(parsed)
    return answer.success
      ? { kind: "ordered", order: answer.data.order }
      : unavailable("answer_shape")
  }
  const message = messageOf(text)
  if (status === OPEN_ORDER.status && message === OPEN_ORDER.message) {
    return { kind: "open" }
  }
  if (status === UNKNOWN_PACK.status && message === UNKNOWN_PACK.message) {
    return { kind: "pack_unknown" }
  }
  return unavailable(`http_${String(status)}`)
}

export async function requestAiCreditOrder(
  input: AiCreditOrderInput,
  options: AiCreditOrderOptions = {}
): Promise<AiCreditOrderResult> {
  const endpoint = options.endpoint === undefined ? aiGatewayEndpoint() : options.endpoint
  if (endpoint === null) {
    return unavailable("control_plane_not_configured")
  }
  const request = aiCreditOrderRequestSchema.safeParse({
    pack_id: input.packId,
    requested_by: input.requestedBy,
  })
  if (!request.success) {
    return unavailable("request_invalid")
  }
  const body = JSON.stringify(request.data)
  if (Buffer.byteLength(body) > AI_CREDIT_ORDER_MAX_BYTES) {
    return unavailable("request_too_large")
  }
  const path = AI_CREDITS_PATHS.orders
  const signed = signRequest({
    method: "POST",
    path,
    tenantId: endpoint.tenantId,
    body,
    signer: endpoint.signer,
    now: (options.now ?? Date.now)(),
  })
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(`${endpoint.url}${path}`, {
      method: "POST",
      headers: { ...signed, "content-type": "application/json", accept: "application/json" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(ORDER_TIMEOUT_MS),
    })
  } catch (error) {
    logger.warn({ event: "ai_credits.order_unreachable", err: errorSummary(error) })
    return unavailable("unreachable")
  }
  const text = await readCapped(response, ORDER_ANSWER_MAX_BYTES).catch(() => null)
  if (text === null) {
    logger.warn({ event: "ai_credits.order_refused", status: response.status, reason: "size" })
    return unavailable("answer_too_large")
  }
  const result = answerOf(response.status, text)
  if (result.kind === "unavailable") {
    logger.warn({ event: "ai_credits.order_refused", status: response.status, reason: result.code })
  }
  return result
}
