import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { AI_INLINE_IMAGE_TYPES } from "./limits"
import type { GatewayTarget } from "./target"

/** What `prepareBody` refuses a body with, by its status: 400 or 413. */
export type BodyRefusal = "body_refused" | "body_too_large"

export type PreparedBody =
  | { ok: true; body: Buffer; contentType: string; images: number }
  | { ok: false; code: BodyRefusal; reason: string }

export interface BodyInput {
  raw: Buffer
  contentType: string
  task: AiCreditTask
  capability: AiCreditCapability
  target: GatewayTarget
}

/**
 * A JSON body rebuilt from the fields the gateway allows: the object to
 * send, the pictures in it, and the bytes those pictures take (base64,
 * left out of the text a task may send).
 */
export interface RebuiltBody {
  body: Record<string, unknown>
  images: number
  imageBytes: number
}

/** Thrown while rebuilding: the body is refused for `reason` (400, `body_refused`). */
export class BodyRefused extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = "BodyRefused"
  }
}

// Standard base64 (what the shop's `Buffer#toString("base64")` writes): no spaces, padding last
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * An inline picture's type and bytes checked (security review N1): a type
 * the gateway takes (limits.ts) and base64 alone, or `BodyRefused`.
 */
export function checkInlineImage(mimeType: string, data: string): void {
  if (!AI_INLINE_IMAGE_TYPES.has(mimeType)) {
    throw new BodyRefused("image_type_refused")
  }
  if (!BASE64.test(data)) {
    throw new BodyRefused("image_data_refused")
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** `application/json` or `multipart/form-data; boundary=…`, lower-cased, parameters dropped. */
export const mediaTypeOf = (contentType: string): string =>
  (contentType.split(";")[0] ?? "").trim().toLowerCase()

// The fields that would call a tool in either protocol: the assistant's turn only
export const TOOL_FIELDS = [
  "tools",
  "tool_choice",
  "functions",
  "function_call",
  "toolConfig",
  "tool_config",
] as const
