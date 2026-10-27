import { isSafeFetchError } from "../security"

/**
 * A request the client refuses to send because of how it was built (a
 * programming error): never retried, never counted against the provider.
 * Messages name the problem and at most a header name, never a value.
 */
export class HttpClientMisuse extends Error {
  override readonly name = "HttpClientMisuse"
}

export type RequestPath = string | readonly string[]
export type QueryValues = Readonly<Record<string, string | number | boolean | undefined>>

// Characters that change what a raw path means: a query, a fragment, a
// backslash, control characters, and dot segments, encoded or not
const UNSAFE_PATH = /[?#\\\p{Cc}]|(?:^|\/)(?:\.|%2e){1,2}(?=\/|$)/iu

/**
 * The URL under `base`: its path prefix is kept (`/api/v1` + `/shipments`)
 * and the result must stay below it. Segments given as an array are
 * encoded one by one, so input such as a tracking number cannot add
 * segments, a query or a fragment.
 */
export function buildUrl(base: URL, path: RequestPath, query: QueryValues = {}): URL {
  const basePath = base.pathname.replace(/\/+$/, "")
  let suffix: string
  if (typeof path === "string") {
    if (!path.startsWith("/") || UNSAFE_PATH.test(path)) {
      throw new HttpClientMisuse("http client: unsafe path")
    }
    suffix = path
  } else {
    if (path.length === 0 || path.some((segment) => ["", ".", ".."].includes(segment))) {
      throw new HttpClientMisuse("http client: unsafe path segment")
    }
    suffix = `/${path.map(encodeURIComponent).join("/")}`
  }
  const url = new URL(base.origin)
  url.pathname = `${basePath}${suffix}`
  if (!url.pathname.startsWith(`${basePath}/`)) {
    throw new HttpClientMisuse("http client: path leaves the base URL")
  }
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(name, String(value))
    }
  }
  return url
}

/** Merges header sets by lowercase name (later wins) and checks every value. */
export function mergeHeaders(
  ...sets: readonly (Readonly<Record<string, string>> | undefined)[]
): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const set of sets) {
    for (const [name, value] of Object.entries(set ?? {})) {
      const lower = name.toLowerCase()
      try {
        new Headers([[lower, value]])
      } catch {
        // fetch's own error quotes the value, which may be a key
        throw new HttpClientMisuse(`http client: invalid value for header ${lower}`)
      }
      merged[lower] = value
    }
  }
  return merged
}

export type FormValues = Readonly<Record<string, string>>

/** The content type of the body `serializeBody` builds from the same arguments. */
export function contentTypeHeader(
  json: unknown,
  form?: FormValues
): Record<string, string> | undefined {
  if (form !== undefined) {
    return { "content-type": "application/x-www-form-urlencoded" }
  }
  return json === undefined ? undefined : { "content-type": "application/json" }
}

/**
 * The request body: JSON, or form fields encoded as
 * `application/x-www-form-urlencoded` (PayTR's APIs take forms). One or
 * the other, never both.
 */
export function serializeBody(
  method: string,
  json: unknown,
  form?: FormValues
): string | undefined {
  if (json === undefined && form === undefined) {
    return undefined
  }
  if (method === "GET" || method === "HEAD") {
    throw new HttpClientMisuse(`http client: ${method} cannot carry a body`)
  }
  if (form !== undefined) {
    if (json !== undefined) {
      throw new HttpClientMisuse("http client: a request has a JSON or a form body, not both")
    }
    return new URLSearchParams(Object.entries(form)).toString()
  }
  let body: unknown
  try {
    body = JSON.stringify(json)
  } catch {
    throw new HttpClientMisuse("http client: the JSON body cannot be serialized")
  }
  // undefined at run time for a function or a symbol, whatever the lib types say
  if (typeof body !== "string") {
    throw new HttpClientMisuse("http client: the JSON body cannot be serialized")
  }
  return body
}

// Failures that happen before a byte of the request leaves: safe to send again
const NOT_SENT_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
])

const codeOf = (value: unknown): string | undefined => {
  const code = (value as { code?: unknown } | null)?.code
  return typeof code === "string" ? code : undefined
}

/**
 * The error's own code or its cause's: undici wraps network errors in
 * `TypeError: fetch failed` with the system error as `cause`.
 */
export function networkErrorCode(error: unknown): string | undefined {
  return codeOf(error) ?? codeOf((error as { cause?: unknown } | null)?.cause)
}

/** True when the request certainly never reached the provider. */
export function wasNotSent(error: unknown): boolean {
  if (isSafeFetchError(error)) {
    return error.reason === "dns_failed"
  }
  const code = networkErrorCode(error)
  return code !== undefined && NOT_SENT_CODES.has(code)
}

/** What a log line says about a network error: names and codes, no message. */
export function describeNetworkError(error: unknown): Record<string, string | undefined> {
  const name = (error as { name?: unknown } | null)?.name
  return {
    name: typeof name === "string" ? name : undefined,
    code: networkErrorCode(error),
  }
}

/** Validates a numeric option: NaN or Infinity would silently lift a limit. */
export function integerOption(
  name: string,
  value: number | undefined,
  fallback: number,
  min: number
): number {
  const chosen = value ?? fallback
  if (!Number.isSafeInteger(chosen) || chosen < min) {
    throw new RangeError(`http client: ${name} must be an integer of at least ${String(min)}`)
  }
  return chosen
}

/** The JSON body, `undefined` for an empty one, or `invalid` when it is not JSON. */
export function parseJsonBody(text: string): { value: unknown } | "invalid" {
  if (text === "") {
    return { value: undefined }
  }
  try {
    return { value: JSON.parse(text) as unknown }
  } catch {
    return "invalid"
  }
}
