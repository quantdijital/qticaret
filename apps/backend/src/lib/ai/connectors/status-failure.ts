import { aiErrorForStatus } from "../errors"
import type { AiErrorKey } from "../errors"
import type { AiService } from "../registry/services"

/**
 * What a non-2xx answer means, the status and, for a 429 of a service
 * that documents its quota errors (`quotaErrors`), the body: a 429 is
 * either a rate (`ai.provider_busy`, tried again once) or an account
 * whose quota for this job is used up or zero (`ai.provider_quota`,
 * never tried again: the next call fails the same way). The body is read
 * here and dropped: only our key and our code leave (adr/0071 §9, §12),
 * never the service's words. A body that cannot be read is a rate, as
 * before.
 */

export interface StatusFailure {
  key: AiErrorKey
  /** `http_429`, `http_429_quota`, `http_402`. */
  code: string
}

// An error body is a few kilobytes; a larger one is not read
const MAX_QUOTA_BODY_BYTES = 64 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

// "Quota exceeded for metric: …, limit: 0, model: …" (the quota is zero on this plan)
const ZERO_LIMIT = /\blimit:\s*0(?![\d.])/

// A daily or monthly quota, not a per-minute rate
const LONG_QUOTA = /per\s*(?:day|month)/i

const isZero = (value: unknown): boolean => value === 0 || value === "0"

/** `{ error }`, or `[{ error }]` as the OpenAI compatibility endpoint may wrap it. */
function googleErrorOf(body: Buffer): Record<string, unknown> | null {
  if (body.length === 0 || body.length > MAX_QUOTA_BODY_BYTES) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(body.toString("utf8"))
  } catch {
    return null
  }
  const outer: unknown = Array.isArray(parsed) ? parsed[0] : parsed
  const error = isRecord(outer) ? outer["error"] : undefined
  return isRecord(error) ? error : null
}

/** A `google.rpc.QuotaFailure` violation that is a zero quota or a daily or monthly one. */
function isQuotaViolation(violation: unknown): boolean {
  if (!isRecord(violation)) {
    return false
  }
  const quotaId = violation["quotaId"]
  return (
    isZero(violation["quotaValue"]) || (typeof quotaId === "string" && LONG_QUOTA.test(quotaId))
  )
}

/**
 * Whether a Gemini 429 says the quota is used up rather than a rate hit:
 * `error.code` `quota_exceeded` (the API errors page), a `QuotaFailure`
 * violation whose quota is zero or daily / monthly (`quotaValue`,
 * `quotaId` such as `GenerateRequestsPerDayPerProjectPerModel-FreeTier`),
 * or `limit: 0` in the message. A free tier per-minute quota alone is a
 * rate: `-FreeTier` decides nothing by itself.
 */
export function googleQuotaUsedUp(body: Buffer): boolean {
  const error = googleErrorOf(body)
  if (error === null) {
    return false
  }
  if (error["code"] === "quota_exceeded") {
    return true
  }
  const details = Array.isArray(error["details"]) ? error["details"] : []
  const violated = details.some((detail: unknown) => {
    if (!isRecord(detail)) {
      return false
    }
    const type = detail["@type"]
    const violations = detail["violations"]
    return (
      typeof type === "string" &&
      type.endsWith("google.rpc.QuotaFailure") &&
      Array.isArray(violations) &&
      violations.some(isQuotaViolation)
    )
  })
  if (violated) {
    return true
  }
  const message = error["message"]
  return typeof message === "string" && ZERO_LIMIT.test(message)
}

/** Our key and code for a status; null for a success. */
export function statusFailure(
  service: AiService,
  status: number,
  body: Buffer
): StatusFailure | null {
  const key = aiErrorForStatus(status)
  if (key === null) {
    return null
  }
  const code = `http_${String(status)}`
  const documented = service.statusErrors?.[status]
  if (documented !== undefined) {
    return { key: documented, code }
  }
  if (status === 429 && service.quotaErrors === "google-rpc" && googleQuotaUsedUp(body)) {
    return { key: "ai.provider_quota", code: `${code}_quota` }
  }
  return { key, code }
}
