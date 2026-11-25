import { chatBody } from "./body-chat"
import { boundaryOf, formRefusal, formTypeOf } from "./body-form"
import { geminiImageBody } from "./body-gemini"
import { BodyRefused, TOOL_FIELDS, isRecord, mediaTypeOf } from "./body-shared"
import type { BodyInput, BodyRefusal, PreparedBody } from "./body-shared"
import { maxBodyBytesOf, maxTextBytesOf } from "./limits"

export { mediaTypeOf } from "./body-shared"
export type { BodyInput, BodyRefusal, PreparedBody } from "./body-shared"

/**
 * A shop's provider body made safe to send (adr/0085 K2, "Güvenlik"): the
 * shop builds the prompt, the gateway writes what costs money. A JSON body
 * is never passed on: a new one is built from the fields the gateway
 * allows (body-chat.ts, body-gemini.ts), the model, the output budget,
 * streaming and the target's fixed fields written by the gateway alone.
 * Its text (the body less its inline pictures) is held to the task's
 * size. A form body (Photoroom) is not parsed: its type (one boundary, no
 * other parameter), its parts' names (body-form.ts) and its size are
 * checked, its bytes go as they came and its type as the gateway writes it. A body that cannot be read or
 * written back (not JSON, nested past what can be written) is refused
 * before any credit is taken. Nothing here reads or keeps what the prompt
 * says.
 */

const refuse = (reason: string, code: BodyRefusal = "body_refused"): PreparedBody => ({
  ok: false,
  code,
  reason,
})

/** The body to send, or why not; `raw` is the shop's signed bytes, never changed in place. */
export function prepareBody(input: BodyInput): PreparedBody {
  const { raw, target, task, capability } = input
  if (raw.length > maxBodyBytesOf(task, capability)) {
    return refuse("over_task_input", "body_too_large")
  }
  const type = mediaTypeOf(input.contentType)
  if (target.protocol === "photoroom") {
    // A form, sent as its bytes: exactly one boundary named, for the provider to read it (N3)
    const boundary = boundaryOf(input.contentType)
    if (type !== "multipart/form-data" || boundary === null) {
      return refuse("type_not_form")
    }
    // Only the parts the shop's connector sends, one file (body-form.ts, review D1)
    const why = formRefusal(raw, input.contentType, task)
    if (why !== null) {
      return refuse(why, why === "over_task_text" ? "body_too_large" : "body_refused")
    }
    // The type rewritten with the boundary read: the provider reads the form as the gateway did
    return { ok: true, body: raw, contentType: formTypeOf(boundary), images: 1 }
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
  try {
    const rebuilt =
      target.protocol === "gemini-image" ? geminiImageBody(parsed, input) : chatBody(parsed, input)
    const body = Buffer.from(JSON.stringify(rebuilt.body))
    if (body.length - rebuilt.imageBytes > maxTextBytesOf(task, capability)) {
      return refuse("over_task_text", "body_too_large")
    }
    return { ok: true, body, contentType: "application/json", images: rebuilt.images }
  } catch (error) {
    // A part not allowed, or nesting too deep to write back (a RangeError)
    return refuse(error instanceof BodyRefused ? error.reason : "unreadable")
  }
}
