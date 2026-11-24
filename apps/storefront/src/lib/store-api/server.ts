import "server-only"
import { cookies, headers } from "next/headers"
import { storefrontEnv } from "../env"
import { bypassCookieName, bypassHeaderOf } from "../maintenance/rules"
import type { QueryValue, StoreRequest } from "./core"
import { storeRequest } from "./core"
import { isNotFound } from "./errors"
import { claimsOf, sessionToken } from "../account/session"
import { shared } from "./shared"
import { visitorIp } from "./visitor"

/**
 * The current request's shopper address and id (server components and
 * actions), and the signed-in customer's key when there is one: every
 * Store API call is then the customer's (their carts, orders, prices).
 * A visitor holding a maintenance bypass cookie sends its token too: a
 * dark shop's backend refuses Store API writes but for a link it signed
 * itself (adr/0053 Ek 2026-11-17), checked there, not here.
 */
async function visit(): Promise<Pick<StoreRequest, "visitorIp" | "requestId" | "headers">> {
  const env = storefrontEnv()
  const [incoming, stored, jar] = await Promise.all([headers(), sessionToken(), cookies()])
  // A token past its end is not sent: the page goes on as a guest's
  const exp = stored ? claimsOf(stored).exp : undefined
  const token = stored && (exp === undefined || exp * 1000 > Date.now()) ? stored : null
  const own: Record<string, string> = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...bypassHeaderOf(jar.get(bypassCookieName(env.NODE_ENV === "production"))?.value),
  }
  return {
    visitorIp: visitorIp(incoming, env.STOREFRONT_TRUSTED_PROXY_HOPS ?? 0),
    requestId: incoming.get("x-request-id"),
    ...(Object.keys(own).length > 0 ? { headers: own } : {}),
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

/** A call with its own method, query, body or headers (a challenge's answer, an order's key, a file). */
export async function storeCall<T>(
  path: string,
  options: Pick<StoreRequest, "method" | "query" | "body" | "rawBody" | "headers" | "timeoutMs">
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

/** A shop-wide call: the visitor's address and request id, never the customer's key. */
async function publicRequest<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  const { visitorIp: ip, requestId } = await visit()
  return (
    await storeRequest<T>(path, {
      visitorIp: ip,
      ...(requestId ? { requestId } : {}),
      ...(query ? { query } : {}),
    })
  ).data
}

/**
 * A write that is nobody's own (a pop-up's counter, adr/0080 §7): the
 * visitor's address for the backend's limit, never the customer's key.
 */
export async function storePublicPost(path: string, body: unknown): Promise<void> {
  const { visitorIp: ip, requestId } = await visit()
  await storeRequest<unknown>(path, {
    method: "POST",
    body,
    visitorIp: ip,
    ...(requestId ? { requestId } : {}),
  })
}

/**
 * A shop-wide GET (the frame, the category tree, paths): never with the
 * customer's key, kept a minute in this process (`shared.ts`). `kept`
 * keeps it longer, under an extra key part the backend is not sent (a
 * price the answer follows, so a new price asks again).
 */
export async function storePublicGet<T>(
  path: string,
  query?: Record<string, QueryValue>,
  kept?: { ttlMs: number; key?: string }
): Promise<T> {
  const extra = kept?.key ? `#${kept.key}` : ""
  return shared(
    `${path}?${JSON.stringify(query ?? {})}${extra}`,
    () => publicRequest<T>(path, query),
    kept?.ttlMs
  )
}

/**
 * A shop-wide GET whose 404 is an answer: "not published" (a legal text
 * the shop has none of), null, kept the same minute as a found answer, so
 * every page does not ask again (docs/21). Any other failure (a 5xx, a
 * timeout) is not kept. The refresh signal drops it as any other answer
 * of its path: the key starts with the path.
 */
export async function storePublicFind<T>(
  path: string,
  query?: Record<string, QueryValue>
): Promise<T | null> {
  return shared(`${path}?${JSON.stringify(query ?? {})}#find`, async () => {
    try {
      return await publicRequest<T>(path, query)
    } catch (error) {
      if (isNotFound(error)) {
        return null
      }
      throw error
    }
  })
}
