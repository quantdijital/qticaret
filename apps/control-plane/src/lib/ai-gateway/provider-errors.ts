/**
 * What a provider's failure may tell a shop (security review of P3b D2,
 * D3; adr/0085 "Ek (P3b)"). The platform's account is the provider's
 * customer, so a provider's error body may name the platform's quota, its
 * balance or its project: it never reaches a shop as written. A non-2xx
 * answer keeps its status and becomes `{"error":{"code":<status>}}`, with
 * only the short codes the shop's own error mapping reads (apps/backend
 * lib/ai/connectors/status-failure.ts, openai-response.ts): a body code
 * (`base_resp.status_code`, MiniMax) and, for a Google service's 429,
 * whether the quota is used up (`"quota_exceeded"`). A 2xx answer must be
 * JSON or a picture; anything else is no answer the shop could read.
 *
 * A failure that is the platform's own (D3): the model or endpoint gone
 * (404) or the platform's key refused in a 400 (Gemini's way): the shop
 * is not charged and is told `unavailable`; the operator reads the
 * service and status in the log.
 */

// Services whose 429 tells a used-up quota by Google's RPC error (the shop's `quotaErrors`)
export const GOOGLE_RPC_QUOTA_SERVICES: ReadonlySet<string> = new Set(["gemini"])

// An error body read is a few kilobytes (the shop's `MAX_QUOTA_BODY_BYTES`)
const MAX_READ_BYTES = 64 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function parsed(body: Buffer): unknown {
  if (body.length === 0 || body.length > MAX_READ_BYTES) {
    return null
  }
  try {
    return JSON.parse(body.toString("utf8"))
  } catch {
    return null
  }
}

// The shop's `googleQuotaUsedUp`: a quota of zero, a daily or monthly one, or the code itself
const ZERO_LIMIT = /\blimit:\s*0(?![\d.])/
const LONG_QUOTA = /per\s*(?:day|month)/i

function quotaViolated(violation: unknown): boolean {
  if (!isRecord(violation)) {
    return false
  }
  const quotaId = violation["quotaId"]
  const value = violation["quotaValue"]
  return value === 0 || value === "0" || (typeof quotaId === "string" && LONG_QUOTA.test(quotaId))
}

export function googleQuotaUsedUp(body: Buffer): boolean {
  const value = parsed(body)
  const outer: unknown = Array.isArray(value) ? value[0] : value
  const error = isRecord(outer) ? outer["error"] : undefined
  if (!isRecord(error)) {
    return false
  }
  if (error["code"] === "quota_exceeded") {
    return true
  }
  const details: unknown[] = Array.isArray(error["details"]) ? error["details"] : []
  const violated = details.some(
    (detail) =>
      isRecord(detail) &&
      typeof detail["@type"] === "string" &&
      detail["@type"].endsWith("google.rpc.QuotaFailure") &&
      Array.isArray(detail["violations"]) &&
      detail["violations"].some(quotaViolated)
  )
  const message = error["message"]
  return violated || (typeof message === "string" && ZERO_LIMIT.test(message))
}

/** A body code the shop maps (`base_resp.status_code`), or null. */
function bodyCodeOf(body: Buffer): number | null {
  const value = parsed(body)
  const base = isRecord(value) ? value["base_resp"] : undefined
  const code = isRecord(base) ? base["status_code"] : undefined
  return typeof code === "number" && Number.isSafeInteger(code) && code !== 0 ? code : null
}

/** A non-2xx answer's body as the shop gets it: its status, and the codes it maps. */
export function normalizedErrorBody(service: string, status: number, body: Buffer): Buffer {
  const quota = status === 429 && GOOGLE_RPC_QUOTA_SERVICES.has(service) && googleQuotaUsedUp(body)
  const code = bodyCodeOf(body)
  return Buffer.from(
    JSON.stringify({
      error: { code: quota ? "quota_exceeded" : status },
      ...(code === null ? {} : { base_resp: { status_code: code } }),
    })
  )
}

/**
 * The 2xx answers the shop can read: JSON, or a raster picture its
 * connectors take (Photoroom's PNG, JPEG or WebP). Never an SVG (a note of
 * the second security review): a document that runs script, not a picture.
 */
const READABLE_ANSWER_TYPES: ReadonlySet<string> = new Set([
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
])

/** A 2xx answer the shop can read: JSON, or a picture. */
export function readableAnswerType(contentType: string): boolean {
  return READABLE_ANSWER_TYPES.has((contentType.split(";")[0] ?? "").trim().toLowerCase())
}

/**
 * A provider saying the platform's key is not valid in a 400, read from
 * the error's structured fields alone (second security review N5): Google
 * RPC's `error.details[].reason`, an OpenAI-compatible `error.code`. The
 * message is never searched: a provider may echo the shop's input in it.
 */
const KEY_REFUSED_REASONS: ReadonlySet<string> = new Set(["API_KEY_INVALID", "API_KEY_EXPIRED"])
/**
 * ... and the platform's own account said to be unpaid, unbought or out of
 * budget (Model Studio's codes; its page gives no status for `Arrearage`):
 * the shop's work was not done and the fault is ours, whatever the status.
 */
const KEY_REFUSED_CODES: ReadonlySet<string> = new Set([
  "invalid_api_key",
  "Arrearage",
  "PrepaidBillOverdue",
  "PostpaidBillOverdue",
  "CommodityNotPurchased",
  "BudgetLimitExceeded",
  "AccessDenied.Unpurchased",
  "AllocationQuota.FreeTierOnly",
])

function keyRefused(body: Buffer): boolean {
  const value = parsed(body)
  const outer: unknown = Array.isArray(value) ? value[0] : value
  const error = isRecord(outer) ? outer["error"] : undefined
  if (!isRecord(error)) {
    return false
  }
  const code = error["code"]
  if (typeof code === "string" && KEY_REFUSED_CODES.has(code)) {
    return true
  }
  const details: unknown[] = Array.isArray(error["details"]) ? error["details"] : []
  return details.some((detail) => {
    const reason = isRecord(detail) ? detail["reason"] : undefined
    return typeof reason === "string" && KEY_REFUSED_REASONS.has(reason)
  })
}

/** The platform's own failure: the model or endpoint gone, or its key or account refused in a 400. */
export function platformFault(status: number, body: Buffer): boolean {
  if (status === 404) {
    return true
  }
  return status === 400 && keyRefused(body)
}
