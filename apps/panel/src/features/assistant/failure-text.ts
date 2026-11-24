import type { TFunction } from "i18next"
import { aiFailureText } from "@/features/ai/failure-text"

// The assistant's own refusals (adr/0079 §12), said in the panel's words
const OWN_WORDS = new Set([
  "assistant_turn_limit",
  "assistant_daily_limit",
  "assistant_no_tool_service",
  "assistant_off",
  "credits_exhausted",
])

/** A failed turn in words: an `ai.*` key of ours, never the service's own text. */
export function assistantFailureText(t: TFunction, failure: unknown): string {
  const code = (failure as { code?: unknown } | null)?.code
  const own = typeof code === "string" && code.startsWith("ai.") ? code.slice(3) : null
  if (own !== null && OWN_WORDS.has(own)) {
    return t(`ai.assistant.errors.${own}`)
  }
  return aiFailureText(t, failure, null)
}
