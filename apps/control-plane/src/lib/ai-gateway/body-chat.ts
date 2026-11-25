import { AI_TASK_LIMITS, maxImagesOf } from "./limits"
import { BodyRefused, isRecord } from "./body-shared"
import type { BodyInput, RebuiltBody } from "./body-shared"

/**
 * An OpenAI-compatible chat body rebuilt from an allow-list (adr/0085 K2,
 * security review of P3b C1): a new object holds only the messages (each
 * one's role, text, inline pictures and, on the assistant's turn, its tool
 * calls), a `json_object` or `text` answer format, a temperature from 0 to
 * 2 and, on the assistant's turn, its function tools. The gateway writes
 * the model, `stream: false`, the output budget in the target's own field
 * (never above the task's) and the target's fixed fields. Every other
 * field a shop sent (`reasoning_effort`, `extra_body`, `service_tier`,
 * `store`, `web_search_options`, `modalities`, `n`, …) is dropped, not
 * refused: a newer shop sending one more field still gets its call.
 */

const ROLES: ReadonlySet<string> = new Set(["system", "user", "assistant", "tool"])
const ANSWER_FORMATS: ReadonlySet<string> = new Set(["json_object", "text"])
const TOOL_CHOICES: ReadonlySet<string> = new Set(["auto", "none"])

interface Pictures {
  count: number
  bytes: number
}

const text = (value: unknown, reason: string): string => {
  if (typeof value !== "string") {
    throw new BodyRefused(reason)
  }
  return value
}

/** A part: text, or a picture inline as a `data:` URL (never an address a provider fetches). */
function partOf(part: unknown, pictures: Pictures): Record<string, unknown> {
  if (!isRecord(part)) {
    throw new BodyRefused("part_refused")
  }
  if (part["type"] === "text") {
    return { type: "text", text: text(part["text"], "part_refused") }
  }
  if (part["type"] !== "image_url") {
    throw new BodyRefused("part_refused")
  }
  const image = part["image_url"]
  const url: unknown = isRecord(image) ? image["url"] : image
  if (typeof url !== "string" || !url.startsWith("data:")) {
    throw new BodyRefused("image_not_inline")
  }
  pictures.count += 1
  pictures.bytes += url.length
  return { type: "image_url", image_url: { url } }
}

function contentOf(content: unknown, pictures: Pictures): unknown {
  if (typeof content === "string" || content === null) {
    return content
  }
  if (!Array.isArray(content)) {
    throw new BodyRefused("content_refused")
  }
  return content.map((part) => partOf(part, pictures))
}

function toolCallOf(call: unknown): Record<string, unknown> {
  const fn: unknown = isRecord(call) ? call["function"] : undefined
  if (!isRecord(call) || call["type"] !== "function" || !isRecord(fn)) {
    throw new BodyRefused("tool_refused")
  }
  return {
    id: text(call["id"], "tool_refused"),
    type: "function",
    function: {
      name: text(fn["name"], "tool_refused"),
      arguments: text(fn["arguments"], "tool_refused"),
    },
  }
}

function messageOf(message: unknown, tools: boolean, pictures: Pictures): Record<string, unknown> {
  const role: unknown = isRecord(message) ? message["role"] : undefined
  if (!isRecord(message) || typeof role !== "string" || !ROLES.has(role)) {
    throw new BodyRefused("message_refused")
  }
  if (role === "tool") {
    if (!tools) {
      throw new BodyRefused("tools_not_allowed")
    }
    return {
      role,
      tool_call_id: text(message["tool_call_id"], "message_refused"),
      content: text(message["content"], "message_refused"),
    }
  }
  const rebuilt: Record<string, unknown> = {
    role,
    content: contentOf(message["content"], pictures),
  }
  const calls = message["tool_calls"]
  if (role === "assistant" && calls !== undefined) {
    if (!tools) {
      throw new BodyRefused("tools_not_allowed")
    }
    if (!Array.isArray(calls)) {
      throw new BodyRefused("tool_refused")
    }
    rebuilt["tool_calls"] = calls.map(toolCallOf)
  }
  return rebuilt
}

/** A function tool: its name, description and parameters (a JSON Schema) only. */
function toolOf(tool: unknown): Record<string, unknown> {
  const fn: unknown = isRecord(tool) ? tool["function"] : undefined
  if (!isRecord(tool) || tool["type"] !== "function" || !isRecord(fn)) {
    throw new BodyRefused("tool_refused")
  }
  const description = fn["description"]
  const parameters = fn["parameters"]
  return {
    type: "function",
    function: {
      name: text(fn["name"], "tool_refused"),
      ...(typeof description === "string" ? { description } : {}),
      ...(isRecord(parameters) ? { parameters } : {}),
    },
  }
}

/** The output budget asked for, if any: a positive whole number in either field. */
const askedBudget = (body: Record<string, unknown>): number | undefined =>
  [body["max_tokens"], body["max_completion_tokens"]].find(
    (value): value is number =>
      typeof value === "number" && Number.isSafeInteger(value) && value > 0
  )

export function chatBody(body: Record<string, unknown>, input: BodyInput): RebuiltBody {
  const { target, task } = input
  const cap = AI_TASK_LIMITS[task].maxOutputTokens
  // A target no field caps is never routed (target.ts); refused here once more
  if (target.maxTokensField === null || cap === null) {
    throw new BodyRefused("uncapped")
  }
  const tools = task === "assistant"
  const messages = body["messages"]
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new BodyRefused("messages_missing")
  }
  const pictures: Pictures = { count: 0, bytes: 0 }
  const rebuilt: Record<string, unknown> = {
    ...target.fixedBody,
    model: target.model,
    messages: messages.map((message) => messageOf(message, tools, pictures)),
    stream: false,
  }
  if (pictures.count > maxImagesOf(task, input.capability)) {
    throw new BodyRefused("too_many_images")
  }
  const asked = askedBudget(body)
  rebuilt[target.maxTokensField] = asked === undefined ? cap : Math.min(asked, cap)
  const format = body["response_format"]
  if (
    isRecord(format) &&
    typeof format["type"] === "string" &&
    ANSWER_FORMATS.has(format["type"])
  ) {
    rebuilt["response_format"] = { type: format["type"] }
  }
  const temperature = body["temperature"]
  if (typeof temperature === "number" && temperature >= 0 && temperature <= 2) {
    rebuilt["temperature"] = temperature
  }
  if (tools && body["tools"] !== undefined) {
    if (!Array.isArray(body["tools"])) {
      throw new BodyRefused("tool_refused")
    }
    rebuilt["tools"] = body["tools"].map(toolOf)
    const choice = body["tool_choice"]
    if (typeof choice === "string" && TOOL_CHOICES.has(choice)) {
      rebuilt["tool_choice"] = choice
    }
  }
  return { body: rebuilt, images: pictures.count, imageBytes: pictures.bytes }
}
