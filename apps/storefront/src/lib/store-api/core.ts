import { storefrontEnv } from "../env"
import { isPageRead, noteRateLimited } from "./busy"
import { StoreApiError } from "./errors"
import { publishableKey } from "./publishable-key"
import { signedVisitorHeaders } from "./visitor"

export type QueryValue = string | number | boolean | readonly string[] | null | undefined

export interface StoreRequest {
  method?: "GET" | "POST" | "DELETE"
  query?: Record<string, QueryValue>
  body?: unknown
  /** A file sent as it is (a review's photo), in place of a JSON body. */
  rawBody?: { bytes: ArrayBuffer; type: string }
  /** The shopper's address, signed for the backend (adr/0046 §5). */
  visitorIp: string | null
  /** The request id to carry on, so one id follows the visit through both servers. */
  requestId?: string | null
  timeoutMs?: number
  /** Extra headers a call needs: a solved challenge (`x-challenge`), an order's key (`x-order-token`). */
  headers?: Record<string, string>
}

export interface StoreAnswer<T> {
  status: number
  data: T
  headers: Headers
}

const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

/**
 * The backend routes the storefront calls: the Store API and the
 * customer's sign-in (`/auth/customer/…`, `/auth/token/refresh`,
 * `/auth/verification/…`). Nothing else gets the key and the session.
 */
const ALLOWED_PREFIXES = ["/store/", "/auth/"] as const

/**
 * One slash, then a path: no `//` or `/\` (another host), no backslash
 * anywhere (the URL parser reads it as a slash), no whitespace or control
 * character (the parser drops tabs and newlines, so `/\t/x` is `//x`).
 */
const SINGLE_SLASH = /^\/(?![/\\])/

const BACKSLASH = 0x5c
const DELETE = 0x7f

function hasUnsafeCharacter(path: string): boolean {
  for (let index = 0; index < path.length; index++) {
    const code = path.charCodeAt(index)
    if (code <= 0x20 || code === DELETE || code === BACKSLASH) {
      return true
    }
  }
  return false
}

/** `.` or `..`, plain or percent-encoded: the parser walks it, an id of ".." would change the route. */
const DOT_SEGMENT = /^(?:\.|%2e){1,2}$/i

const hasDotSegment = (path: string): boolean =>
  (path.split(/[?#]/, 1)[0] ?? "").split("/").some((segment) => DOT_SEGMENT.test(segment))

/** A path the storefront would not send to the backend; the request never leaves. */
export class StorePathError extends Error {
  override readonly name = "StorePathError"
}

/**
 * The backend's URL for a path, or `StorePathError`: it must stay on the
 * backend's origin and under an allowed prefix, whatever the path holds
 * (an absolute URL, `//host`, `..`). The error names the origin it would
 * have gone to at most, never the path (it can carry a token).
 */
export function storeUrl(path: string, query: Record<string, QueryValue> = {}): URL {
  const backend = new URL(storefrontEnv().MEDUSA_BACKEND_URL)
  if (
    typeof path !== "string" ||
    !SINGLE_SLASH.test(path) ||
    hasUnsafeCharacter(path) ||
    hasDotSegment(path)
  ) {
    throw new StorePathError("Store API path refused: not a backend path")
  }
  const url = new URL(path, backend)
  if (url.origin !== backend.origin) {
    throw new StorePathError(`Store API path refused: it leaves the backend (${url.origin})`)
  }
  if (!ALLOWED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    throw new StorePathError("Store API path refused: not under an allowed prefix")
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue
    }
    const values: readonly string[] = typeof value === "object" ? value : [String(value)]
    for (const each of values) {
      url.searchParams.append(key, each)
    }
  }
  return url
}

/**
 * One Store API call from the storefront's server (adr/0046 §5): with the
 * publishable key, the signed shopper address and, for a change, our own
 * origin (the backend's CSRF check). Never cached by Next: prices and
 * stock come fresh, the backend caches what may be cached. A non-2xx
 * answer throws `StoreApiError` with the backend's message key.
 */
export async function storeRequest<T>(
  path: string,
  request: StoreRequest
): Promise<StoreAnswer<T>> {
  // Checked first: a refused path costs no key lookup and sends nothing
  const url = storeUrl(path, request.query)
  const env = storefrontEnv()
  const method = request.method ?? "GET"
  const headers: Record<string, string> = {
    ...request.headers,
    accept: "application/json",
    "x-publishable-api-key": await publishableKey(env),
    ...signedVisitorHeaders(env.STOREFRONT_IP_SECRET, request.visitorIp),
  }
  if (request.requestId && REQUEST_ID.test(request.requestId)) {
    headers["x-request-id"] = request.requestId
  }
  if (method !== "GET") {
    headers["origin"] = env.STOREFRONT_ORIGIN
  }
  if (request.rawBody) {
    headers["content-type"] = request.rawBody.type
  } else if (request.body !== undefined) {
    headers["content-type"] = "application/json"
  }
  const response = await fetch(url, {
    method,
    headers,
    body: request.rawBody
      ? request.rawBody.bytes
      : request.body === undefined
        ? null
        : JSON.stringify(request.body),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(request.timeoutMs ?? 8000),
  })
  const text = await response.text()
  if (response.status === 429 && isPageRead(method, path)) {
    // The visitor's next page views answer 503 until the backend takes them again (`busy.ts`)
    noteRateLimited(request.visitorIp, response.headers.get("retry-after"))
  }
  if (!response.ok) {
    // The backend's JSON, or a page: a feature that is off answers as a route that does not exist (adr/0012)
    const body = (jsonOrNull(text) ?? {}) as { message?: unknown; request_id?: unknown }
    throw new StoreApiError(
      response.status,
      typeof body.message === "string" ? body.message : null,
      typeof body.request_id === "string" ? body.request_id : null,
      body
    )
  }
  const data: unknown = text === "" ? null : JSON.parse(text)
  return { status: response.status, data: data as T, headers: response.headers }
}

/** An error answer's body as JSON; null when it is none (an HTML page, nothing). */
function jsonOrNull(text: string): unknown {
  try {
    return text === "" ? null : (JSON.parse(text) as unknown)
  } catch {
    return null
  }
}
