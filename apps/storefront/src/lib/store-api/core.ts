import { storefrontEnv } from "../env"
import { StoreApiError } from "./errors"
import { publishableKey } from "./publishable-key"
import { signedVisitorHeaders } from "./visitor"

export type QueryValue = string | number | boolean | readonly string[] | null | undefined

export interface StoreRequest {
  method?: "GET" | "POST" | "DELETE"
  query?: Record<string, QueryValue>
  body?: unknown
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

export function storeUrl(path: string, query: Record<string, QueryValue> = {}): URL {
  const url = new URL(path, storefrontEnv().MEDUSA_BACKEND_URL)
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
  if (request.body !== undefined) {
    headers["content-type"] = "application/json"
  }
  const response = await fetch(storeUrl(path, request.query), {
    method,
    headers,
    body: request.body === undefined ? null : JSON.stringify(request.body),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(request.timeoutMs ?? 8000),
  })
  const text = await response.text()
  const data: unknown = text === "" ? null : JSON.parse(text)
  if (!response.ok) {
    const body = (data ?? {}) as { message?: unknown; request_id?: unknown }
    throw new StoreApiError(
      response.status,
      typeof body.message === "string" ? body.message : null,
      typeof body.request_id === "string" ? body.request_id : null,
      body
    )
  }
  return { status: response.status, data: data as T, headers: response.headers }
}
