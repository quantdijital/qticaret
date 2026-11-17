import { isProviderError } from "../errors/errors"
import { AI_ERROR_KEYS } from "./errors"
import type { AiErrorKey } from "./errors"

/**
 * What a failed call is recorded as (adr/0071 §5, §8). The connector
 * gives a timeout two codes: `timeout` when the call's own deadline ran
 * out, `aborted` when the caller let go first. Only the first is
 * `timeout`; the second is the caller's cancelling (`cancelled`), so the
 * usage report does not blame the service for it.
 */

export type AiFailureStatus = "failed" | "timeout" | "cancelled"

export interface AiFailure {
  status: AiFailureStatus
  key: AiErrorKey
  /** Our short code (`http_503`, `timeout`, `circuit_open`); never the service's text. */
  code: string
  /** The service could not be reached or did not answer in time. */
  unwell: boolean
  /** The service answered (it refused the key, the balance, the content, or is busy). */
  answered: boolean
}

const isAiErrorKey = (value: string): value is AiErrorKey =>
  (AI_ERROR_KEYS as readonly string[]).includes(value)

const ANSWERED: ReadonlySet<AiErrorKey> = new Set([
  "ai.key_rejected",
  "ai.provider_balance",
  "ai.provider_busy",
  "ai.content_blocked",
])

/** A thrown error as a usage status; anything not from a connector is a plain failure. */
export function failureOf(error: unknown): AiFailure {
  const provider = isProviderError(error) ? error : null
  const key = provider && isAiErrorKey(provider.safeMessage) ? provider.safeMessage : null
  const code = provider?.providerCode ?? "unexpected"
  if (key === null) {
    return {
      status: "failed",
      key: "ai.provider_response_invalid",
      code,
      unwell: false,
      answered: false,
    }
  }
  if (key === "ai.timeout") {
    const cancelled = code === "aborted"
    return {
      status: cancelled ? "cancelled" : "timeout",
      key,
      code,
      unwell: !cancelled,
      answered: false,
    }
  }
  return {
    status: "failed",
    key,
    code,
    unwell: key === "ai.provider_unavailable" && code !== "circuit_open",
    answered: ANSWERED.has(key),
  }
}
