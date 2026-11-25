import type { AiCreditCapability, AiCreditTask } from "@qticaret/types/control-plane"
import { AI_TASK_LIMITS, maxBodyBytesOf, maxImagesOf } from "./limits"
import type { GatewayTarget } from "./target"

/**
 * A shop's provider body made safe to send (adr/0085 K2, "Güvenlik"): the
 * shop builds the prompt, the gateway writes what costs money. In a JSON
 * body the model is the routing's (whatever the shop wrote), the output
 * budget is cut to the task's, streaming is off, one answer only, tools
 * only on the assistant's turn, pictures only as many as the task sends
 * and only inline (never an address a provider would fetch). A form body
 * (Photoroom) is not parsed: its type and size are checked and its bytes
 * go as they came. Nothing here reads or keeps what the prompt says.
 */

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

const refuse = (reason: string, code: BodyRefusal = "body_refused"): PreparedBody => ({
  ok: false,
  code,
  reason,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** `application/json` or `multipart/form-data; boundary=…`, lower-cased, parameters dropped. */
export const mediaTypeOf = (contentType: string): string =>
  (contentType.split(";")[0] ?? "").trim().toLowerCase()

// The fields that would call a tool, many answers or a stream in either protocol
const TOOL_FIELDS = [
  "tools",
  "tool_choice",
  "functions",
  "function_call",
  "toolConfig",
  "tool_config",
]
const MANY_FIELDS = ["n", "candidateCount", "candidate_count"]

/** An OpenAI chat message's picture parts; null when one is not inline (`data:`). */
function chatImages(messages: unknown): number | null {
  let count = 0
  for (const message of Array.isArray(messages) ? messages : []) {
    const content: unknown = isRecord(message) ? message["content"] : undefined
    for (const part of Array.isArray(content) ? content : []) {
      if (!isRecord(part) || part["type"] === "text") {
        continue
      }
      const image = part["image_url"]
      const url: unknown = isRecord(image) ? image["url"] : image
      if (part["type"] !== "image_url" || typeof url !== "string" || !url.startsWith("data:")) {
        return null
      }
      count += 1
    }
  }
  return count
}

/** A Gemini body's inline pictures; null for a part that names a file or an address. */
function geminiImages(contents: unknown): number | null {
  let count = 0
  for (const content of Array.isArray(contents) ? contents : []) {
    const parts: unknown = isRecord(content) ? content["parts"] : undefined
    for (const part of Array.isArray(parts) ? parts : []) {
      if (!isRecord(part)) {
        continue
      }
      if ("file_data" in part || "fileData" in part) {
        return null
      }
      if ("inline_data" in part || "inlineData" in part) {
        count += 1
      }
    }
  }
  return count
}

function rewriteChat(body: Record<string, unknown>, input: BodyInput): PreparedBody | null {
  const { target, task } = input
  const images = chatImages(body["messages"])
  if (images === null) {
    return refuse("image_not_inline")
  }
  if (images > maxImagesOf(task, input.capability)) {
    return refuse("too_many_images")
  }
  body["model"] = target.model
  body["stream"] = false
  delete body["stream_options"]
  for (const field of MANY_FIELDS) {
    if (field in body) {
      body[field] = 1
    }
  }
  const cap = AI_TASK_LIMITS[task].maxOutputTokens
  // Whatever budget the shop wrote: only the target's field, never above the task's
  const asked = [body["max_tokens"], body["max_completion_tokens"]].find(
    (value): value is number =>
      typeof value === "number" && Number.isSafeInteger(value) && value > 0
  )
  delete body["max_tokens"]
  delete body["max_completion_tokens"]
  if (target.maxTokensField && cap !== null) {
    body[target.maxTokensField] = asked === undefined ? cap : Math.min(asked, cap)
  }
  return {
    ok: true,
    body: Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    images,
  }
}

function rewriteGemini(body: Record<string, unknown>, input: BodyInput): PreparedBody {
  const images = geminiImages(body["contents"])
  if (images === null) {
    return refuse("image_not_inline")
  }
  if (images > maxImagesOf(input.task, input.capability)) {
    return refuse("too_many_images")
  }
  // The model is the address's (the routing's); a body naming one is not read
  delete body["model"]
  const config = body["generationConfig"] ?? body["generation_config"]
  if (isRecord(config)) {
    for (const field of MANY_FIELDS) {
      if (field in config) {
        config[field] = 1
      }
    }
  }
  return {
    ok: true,
    body: Buffer.from(JSON.stringify(body)),
    contentType: "application/json",
    images,
  }
}

/** The body to send, or why not; `raw` is the shop's signed bytes, never changed in place. */
export function prepareBody(input: BodyInput): PreparedBody {
  const { raw, target, task, capability } = input
  if (raw.length > maxBodyBytesOf(task, capability)) {
    return refuse("over_task_input", "body_too_large")
  }
  const type = mediaTypeOf(input.contentType)
  if (target.protocol === "photoroom") {
    // A form, sent as its bytes: the boundary must be named for the provider to read it
    return type === "multipart/form-data" && /;\s*boundary=/i.test(input.contentType)
      ? { ok: true, body: raw, contentType: input.contentType, images: 1 }
      : refuse("type_not_form")
  }
  if (type !== "application/json") {
    return refuse("type_not_json")
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.toString("utf8"))
  } catch {
    return refuse("not_json")
  }
  if (!isRecord(parsed)) {
    return refuse("not_an_object")
  }
  if (task !== "assistant" && TOOL_FIELDS.some((field) => field in parsed)) {
    return refuse("tools_not_allowed")
  }
  if (target.protocol === "gemini-image") {
    return rewriteGemini(parsed, input)
  }
  return rewriteChat(parsed, input) ?? refuse("unreadable")
}
