import { AI_CALL_HEADERS, aiCallHeadersSchema } from "@qticaret/types/control-plane"
import type { AiCallHeaders, AiTargetAuth } from "@qticaret/types/control-plane"

/**
 * The headers on either side of the gateway (adr/0085 "Güvenlik"). To the
 * provider go exactly three: the body's type, what is accepted, and the
 * key in the one header the service reads; none of the shop's (its
 * signature, cookies, a key of its own, a host) is ever passed on. Back
 * to the shop goes the answer's type alone: no cookie, no account or
 * rate header, nothing the provider calls `x-qt-*`.
 */

type IncomingHeaders = Record<string, string | string[] | undefined>

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? undefined : value

/**
 * The call's four headers (task, capability, service, operation), held to
 * the contract; null when one is missing, repeated or not of its shape.
 * Only these are read: the signature's own headers are the guard's.
 */
export function callHeadersOf(headers: IncomingHeaders): AiCallHeaders | null {
  const picked = Object.fromEntries(
    Object.values(AI_CALL_HEADERS).map((name) => [name, single(headers[name])])
  )
  const parsed = aiCallHeadersSchema.safeParse(picked)
  return parsed.success ? parsed.data : null
}

/**
 * The headers sent to the provider: the key opened just now (a Buffer,
 * zeroed by the caller once sent), the body's type, `accept`. Nothing else.
 */
export function providerHeaders(
  auth: AiTargetAuth,
  key: Buffer,
  contentType: string
): Record<string, string> {
  const value = key.toString("utf8")
  const credential: Record<string, string> =
    auth === "bearer"
      ? { authorization: `Bearer ${value}` }
      : auth === "x-api-key"
        ? { "x-api-key": value }
        : { "x-goog-api-key": value }
  return { "content-type": contentType, accept: "application/json, image/*", ...credential }
}

// A type the shop reads: one line, a token/subtype and its parameters, nothing longer
const CONTENT_TYPE = /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:\s*;[\x20-\x7e]*)?$/

/** The provider's answer type as passed on; `application/octet-stream` when it is none we read. */
export function answerContentType(value: string | null): string {
  return value !== null && value.length <= 200 && CONTENT_TYPE.test(value)
    ? value
    : "application/octet-stream"
}
