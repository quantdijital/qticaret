import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
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
