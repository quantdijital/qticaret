import { SafeFetchError } from "./errors"

/**
 * - `same-origin` (default): redirects within the origin only;
 * - `follow`: other origins too, carrying only harmless headers;
 * - `error`: no redirects at all (webhook delivery).
 */
export type RedirectMode = "same-origin" | "follow" | "error"

export interface Hop {
  method: string
  headers: Record<string, string>
  body?: string | Buffer
}

// What may travel to another origin: a server holding tenant secrets cannot
// rely on browser rules, where CORS keeps custom headers from leaving
const CROSS_ORIGIN_HEADERS = new Set(["accept", "accept-language", "user-agent"])
// Dropped with the body when a redirect turns the request into a GET
const BODY_HEADERS = new Set([
  "content-type",
  "content-length",
  "content-encoding",
  "content-language",
  "content-location",
  "transfer-encoding",
])

const refuse = () => new SafeFetchError("redirect_not_allowed")

/**
 * The request to send to `to` after `status` from `from`, or a refusal:
 * a mode that forbids it, an https to http downgrade, or a body that would
 * follow a 307/308 to another origin.
 */
export function nextHop(status: number, hop: Hop, from: URL, to: URL, mode: RedirectMode): Hop {
  const crossOrigin = from.origin !== to.origin
  if (mode === "error" || (mode === "same-origin" && crossOrigin)) {
    throw refuse()
  }
  if (from.protocol === "https:" && to.protocol === "http:") {
    throw refuse()
  }
  const asGet =
    (status === 303 || (status !== 307 && status !== 308 && hop.method === "POST")) &&
    hop.method !== "HEAD"
  if (crossOrigin && !asGet && hop.body !== undefined) {
    throw refuse()
  }
  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(hop.headers)) {
    const lower = name.toLowerCase()
    if ((crossOrigin && !CROSS_ORIGIN_HEADERS.has(lower)) || (asGet && BODY_HEADERS.has(lower))) {
      continue
    }
    headers[name] = value
  }
  if (asGet) {
    return { method: "GET", headers }
  }
  return hop.body === undefined
    ? { method: hop.method, headers }
    : { method: hop.method, headers, body: hop.body }
}
