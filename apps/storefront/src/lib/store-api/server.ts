import "server-only"
import { headers } from "next/headers"
import { storefrontEnv } from "../env"
import type { QueryValue, StoreRequest } from "./core"
import { storeRequest } from "./core"
import { claimsOf, sessionToken } from "../account/session"
import { visitorIp } from "./visitor"

/**
 * The current request's shopper address and id (server components and
 * actions), and the signed-in customer's key when there is one: every
 * Store API call is then the customer's (their carts, orders, prices).
 */
async function visit(): Promise<Pick<StoreRequest, "visitorIp" | "requestId" | "headers">> {
  const [incoming, stored] = await Promise.all([headers(), sessionToken()])
  // A token past its end is not sent: the page goes on as a guest's
  const exp = stored ? claimsOf(stored).exp : undefined
  const token = stored && (exp === undefined || exp * 1000 > Date.now()) ? stored : null
  return {
    visitorIp: visitorIp(incoming, storefrontEnv().STOREFRONT_TRUSTED_PROXY_HOPS ?? 0),
    requestId: incoming.get("x-request-id"),
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  }
}

export async function storeGet<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  return (await storeRequest<T>(path, { ...(await visit()), ...(query ? { query } : {}) })).data
}

export async function storePost<T>(path: string, body: unknown): Promise<T> {
  return (await storeRequest<T>(path, { ...(await visit()), method: "POST", body })).data
}

export async function storeDelete<T>(path: string, body?: unknown): Promise<T> {
  return (
    await storeRequest<T>(path, {
      ...(await visit()),
      method: "DELETE",
      ...(body === undefined ? {} : { body }),
    })
  ).data
}

/** A call with its own method, query, body or headers (a challenge's answer, an order's key). */
export async function storeCall<T>(
  path: string,
  options: Pick<StoreRequest, "method" | "query" | "body" | "headers">
): Promise<T> {
  const own = await visit()
  return (
    await storeRequest<T>(path, {
      ...own,
      ...options,
      // A call's own key (a reset link's, a registration's) goes before the session's
      headers: { ...own.headers, ...options.headers },
    })
  ).data
}

/** A call whose answer's headers matter too (a cookie the backend hands the visitor). */
export async function storeCallWithHeaders(
  path: string,
  options: Pick<StoreRequest, "method" | "query" | "body" | "headers">
): Promise<{ data: unknown; headers: Headers }> {
  const own = await visit()
  const answer = await storeRequest<unknown>(path, {
    ...own,
    ...options,
    headers: { ...own.headers, ...options.headers },
  })
  return { data: answer.data, headers: answer.headers }
}
