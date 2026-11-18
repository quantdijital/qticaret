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

// The service said no before doing anything: it holds no work to charge for
const NOT_TAKEN_KEYS: ReadonlySet<AiErrorKey> = new Set([
  "ai.key_rejected",
  "ai.provider_balance",
  "ai.provider_busy",
  // Ours, before any call: no readable key, or a service this instance does not list
  "ai.service_unavailable",
  // Ours, before any call: a picture gone, or one no service reads (SVG, a background it cannot make)
  "ai.unknown_entity",
  "ai.input_unsupported",
])

// No connection, an open circuit, or a 5xx (adr/0071 §8: the service did not take the job)
const NO_CONNECTION: ReadonlySet<string> = new Set(["circuit_open", "dns_failed", "connect_failed"])
const notConnected = (code: string): boolean => NO_CONNECTION.has(code) || /^http_5\d\d$/.test(code)

/**
 * Whether a failed call never became work at the service (adr/0071 §8.4),
 * so the quota claimed for it is given back. A timeout, a cut answer, a
 * blocked content or an invalid answer may have been charged: they stay.
 */
export function notTakenByService(key: AiErrorKey, code: string | null): boolean {
  if (NOT_TAKEN_KEYS.has(key)) {
    return true
  }
  return key === "ai.provider_unavailable" && code !== null && notConnected(code)
}
