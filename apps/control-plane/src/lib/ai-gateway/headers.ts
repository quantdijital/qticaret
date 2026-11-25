import { aiCallParamsSchema } from "@qticaret/types/control-plane"
import type { AiCallParams, AiTargetAuth } from "@qticaret/types/control-plane"

/**
 * What a call says and what crosses the gateway (adr/0085 "Güvenlik"). The
 * call's four values come from the signed target's query alone. To the
 * provider go exactly three headers: the body's type, what is accepted,
 * and the key in the one header the service reads; none of the shop's
 * (its signature, cookies, a key of its own, a host) is ever passed on.
 * Back to the shop goes the answer's type alone: no cookie, no account or
 * rate header, nothing the provider calls `x-qt-*`.
 */

// Any base: only the query of the target is read (an absolute-form target keeps its own)
const BASE = "http://gateway.invalid"

/**
 * The call's four values (task, capability, service, operation) from the
 * request target the signature covered, held to the contract; null when
 * one is missing, repeated, not of its shape, or the query names anything
 * else. No header is read for them: a header is not signed.
 */
export function callParamsOf(target: string): AiCallParams | null {
  let search: URLSearchParams
  try {
    search = new URL(target, BASE).searchParams
  } catch {
    return null
  }
  const picked: Record<string, string | string[]> = {}
  for (const name of new Set(search.keys())) {
    const values = search.getAll(name)
    const [only] = values
    picked[name] = values.length === 1 && only !== undefined ? only : values
  }
  const parsed = aiCallParamsSchema.safeParse(picked)
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
