import {
  DEFAULT_CONFLICT_MESSAGE,
  DEFAULT_PROVIDER_MESSAGE,
  DEFAULT_RETRYABLE_MESSAGE,
  DEFAULT_VALIDATION_MESSAGE,
  isConflictError,
  isProviderError,
  isRetryableError,
  isValidationError,
} from "./errors"
import type { ProviderErrorShape } from "./errors"
import { isPlanLimitError } from "./plan-limit"
import { providerText } from "./provider-text"

export interface HttpErrorResponse {
  status: number
  /** Same shape as Medusa's error responses; `message` is an i18n key. */
  body: {
    type: string
    message: string
    count?: number
    /** What a validation error's sentence names (`ValidationError` `values`). */
    values?: Record<string, string>
    /** Which service failed (`aras`): the admin API only. */
    provider?: string
    /** What it said, made safe (`providerText`): the admin API only. */
    provider_message?: string
    /** Other services to try (adr/0071 §4): the admin API only. */
    alternatives?: string[]
    /** A plan limit refusal's (`plan.limit_reached`): which limit, used now, allowed. */
    limit?: string
    used?: number
    max?: number
  }
  retryAfterSeconds?: number
}

export interface HttpErrorOptions {
  /**
   * The admin API's answer to a provider's failure (staff, not shoppers):
   * `provider.failed` naming the service and what it said, so staff can
   * tell "Aras refused the user name" from "try again later".
   */
  providerDetail?: boolean
}

/** A provider's failure on the admin API, `{ provider, provider_message? }` beside it. */
export const PROVIDER_FAILED_MESSAGE = "provider.failed"

// Our own provider names (`aras`, `yurtici`, `dhlecommerce`, `surat`), never text from outside
const PROVIDER_NAME = /^[a-z][a-z0-9_-]{0,31}$/

export interface ProviderDetail {
  provider: string
  provider_message?: string
  alternatives?: string[]
}

// At most a registry's worth, each one of our own names
const MAX_ALTERNATIVES = 10

function alternativesOf(value: unknown): { alternatives?: string[] } {
  if (!Array.isArray(value)) {
    return {}
  }
  const names = value
    .filter((each): each is string => typeof each === "string" && PROVIDER_NAME.test(each))
    .slice(0, MAX_ALTERNATIVES)
  return { alternatives: names }
}

function providerDetail(value: ProviderErrorShape): ProviderDetail | null {
  if (!PROVIDER_NAME.test(value.provider)) {
    return null
  }
  // Made safe again: a workflow hands the error back as a plain object
  const said = providerText(value.providerMessage)
  return {
    provider: value.provider,
    ...(said === undefined ? {} : { provider_message: said }),
    ...alternativesOf(value.alternatives),
  }
}

/**
 * A provider's failure as staff hear it (a report row of a bulk action):
 * which service, what it said, whether it may answer later. Null for any
 * other error.
 */
export function providerFailureOf(
  value: unknown
): (ProviderDetail & { retryable: boolean }) | null {
  if (!isProviderError(value)) {
    return null
  }
  const detail = providerDetail(value)
  return detail ? { ...detail, retryable: value.retryable } : null
}

// A provider's Retry-After passes through to our clients; it is capped so a
// provider cannot set what we tell them
const MAX_RETRY_AFTER_SECONDS = 300

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0

// A value is a few words for a sentence; anything else is not sent
const MAX_VALUES = 5
const MAX_VALUE_LENGTH = 500

/** A validation error's sentence values that are short strings, or nothing. */
function valuesOf(value: unknown): { values?: Record<string, string> } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] =>
      /^[a-z_]+$/.test(entry[0]) &&
      typeof entry[1] === "string" &&
      entry[1].length <= MAX_VALUE_LENGTH
  )
  return entries.length > 0 && entries.length <= MAX_VALUES
    ? { values: Object.fromEntries(entries) }
    : {}
}

const retryAfterSecondsOf = (ms: number): number =>
  Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(ms / 1000)))

// `billing_profile.tax_id_invalid`: dotted snake_case, nothing else
/** What an i18n key looks like (`catalog.handle_invalid`), the only message clients get. */
export const I18N_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/

/** A `safeMessage` that is not an i18n key (say, provider text) never reaches the client. */
const clientMessage = (safeMessage: string, fallback: string): string =>
  I18N_KEY.test(safeMessage) ? safeMessage : fallback

/**
 * HTTP response for the platform's own error types, or null for anything
 * else so the caller falls back to Medusa's handler. Only the i18n key
 * leaves the server: never `cause`, the log message or the provider's code;
 * the provider and its own words only with `providerDetail`.
 */
export function toHttpError(
  value: unknown,
  options: HttpErrorOptions = {}
): HttpErrorResponse | null {
  if (isValidationError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_VALIDATION_MESSAGE)
    // Values go with the rule's own key only, never with the fallback's sentence
    const values = message === value.safeMessage ? valuesOf(value.values) : {}
    return { status: 400, body: { type: "invalid_data", message, ...values } }
  }
  if (isPlanLimitError(value)) {
    // Numbers the shop's own counts gave, never input (adr/0061 §5.3)
    const { limit, used, max } = value
    return {
      status: 403,
      body: { type: "not_allowed", message: value.safeMessage, limit, used, max },
    }
  }
  if (isConflictError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_CONFLICT_MESSAGE)
    // A count is a number the rule computed, never input: it passes through
    const count = isCount(value.count) ? { count: value.count } : {}
    return { status: 409, body: { type: "conflict", message, ...count } }
  }
  if (isProviderError(value)) {
    const detail = options.providerDetail ? providerDetail(value) : null
    // A call's own key stays; the default one becomes the provider's
    const message =
      detail && value.safeMessage === DEFAULT_PROVIDER_MESSAGE
        ? PROVIDER_FAILED_MESSAGE
        : clientMessage(value.safeMessage, DEFAULT_PROVIDER_MESSAGE)
    if (!value.retryable) {
      return { status: 502, body: { type: "provider_error", message, ...detail } }
    }
    const response: HttpErrorResponse = {
      status: 503,
      body: { type: "provider_unavailable", message, ...detail },
    }
    if (value.retryAfterMs !== undefined) {
      response.retryAfterSeconds = retryAfterSecondsOf(value.retryAfterMs)
    }
    return response
  }
  if (isRetryableError(value)) {
    const message = clientMessage(value.safeMessage, DEFAULT_RETRYABLE_MESSAGE)
    const response: HttpErrorResponse = {
      status: 503,
      body: { type: "temporarily_unavailable", message },
    }
    if (value.retryAfterMs !== undefined) {
      response.retryAfterSeconds = retryAfterSecondsOf(value.retryAfterMs)
    }
    return response
  }
  return null
}
