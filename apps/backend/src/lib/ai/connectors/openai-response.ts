import type { AiErrorKey } from "../errors"
import type { AiService } from "../registry/services"
import type { AiUsage, TextResult } from "./types"

/**
 * Reading an OpenAI style chat completion answer. Only the text, the
 * counts and registered codes are taken; the rest of the body, an error
 * message included, is dropped here and goes nowhere (adr/0071 §9).
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function parse(body: Buffer): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body.toString("utf8"))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * A code the service writes in the body (`base_resp.status_code`), for
 * services that register such codes. An unregistered one is still a
 * failure: the answer is not what the registry describes.
 */
export function registeredBodyError(
  service: AiService,
  body: Buffer
): { key: AiErrorKey; code: number } | null {
  if (service.bodyErrors === undefined) {
    return null
  }
  const base = parse(body)?.["base_resp"]
  const code = isRecord(base) ? base["status_code"] : undefined
  if (typeof code !== "number" || !Number.isSafeInteger(code) || code === 0) {
    return null
  }
  return { key: service.bodyErrors[code] ?? "ai.provider_response_invalid", code }
}

const count = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined

function usageOf(answer: Record<string, unknown>): AiUsage {
  const usage = answer["usage"]
  if (!isRecord(usage)) {
    return {}
  }
  const inputTokens = count(usage["prompt_tokens"])
  const outputTokens = count(usage["completion_tokens"])
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
  }
}

// A model's thinking written into the text; never part of a suggestion
const THINKING = /<think>[\s\S]*?<\/think>/gi

export type CompletionRead =
  { ok: true; result: TextResult } | { ok: false; key: AiErrorKey; code: string }

/** The text of a successful answer, or why it is not one. */
export function readCompletion(body: Buffer): CompletionRead {
  const invalid = (code: string): CompletionRead => ({
    ok: false,
    key: "ai.provider_response_invalid",
    code,
  })
  const answer = parse(body)
  if (answer === null) {
    return invalid("not_json")
  }
  const choices = answer["choices"]
  const choice: unknown = Array.isArray(choices) ? choices[0] : undefined
  if (!isRecord(choice)) {
    return invalid("no_choice")
  }
  if (choice["finish_reason"] === "content_filter") {
    return { ok: false, key: "ai.content_blocked", code: "content_filter" }
  }
  const message = choice["message"]
  const content = isRecord(message) ? message["content"] : undefined
  if (typeof content !== "string") {
    return invalid("no_content")
  }
  const text = content.replace(THINKING, "").trim()
  if (text === "") {
    return invalid("empty_content")
  }
  return { ok: true, result: { text, usage: usageOf(answer) } }
}
