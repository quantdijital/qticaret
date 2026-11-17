import type { TFunction } from "i18next"
import type { AiFailure } from "@/features/ai/api/suggestions"
import { errorText } from "@/lib/errors"

// The backend's keys the panel says in its own words (adr/0071 §12); others fall to `errorText`
const OWN_WORDS = new Set([
  "no_service",
  "service_unavailable",
  "own_keys_not_in_plan",
  "key_rejected",
  "provider_balance",
  "provider_busy",
  "provider_unavailable",
  "timeout",
  "content_blocked",
  "provider_response_invalid",
  "input_unsupported",
  "daily_limit_reached",
])

/** A service's name in the panel's words (`ai.services.<id>.name`), or its id. */
export const serviceName = (t: TFunction, id: string | null): string =>
  id ? t(`ai.services.${id}.name`, { defaultValue: id }) : ""

/** A failed suggestion in words: never the service's own text, only our key's sentence. */
export function aiFailureText(t: TFunction, failure: unknown, service: string | null): string {
  const code = (failure as Partial<AiFailure> | null)?.code
  const own = typeof code === "string" && code.startsWith("ai.") ? code.slice(3) : null
  if (own !== null && OWN_WORDS.has(own)) {
    return t(`ai.errors.${own}`, { name: serviceName(t, service) || t("ai.title") })
  }
  return errorText(t, failure)
}
