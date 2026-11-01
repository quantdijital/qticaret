import "server-only"
import { headers } from "next/headers"
import { storefrontEnv } from "../env"
import type { QueryValue, StoreRequest } from "./core"
import { storeRequest } from "./core"
import { visitorIp } from "./visitor"

/** The current request's shopper address and id (server components and actions). */
async function visit(): Promise<Pick<StoreRequest, "visitorIp" | "requestId">> {
  const incoming = await headers()
  return {
    visitorIp: visitorIp(incoming, storefrontEnv().STOREFRONT_TRUSTED_PROXY_HOPS ?? 0),
    requestId: incoming.get("x-request-id"),
  }
}

export async function storeGet<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  return (await storeRequest<T>(path, { ...(await visit()), ...(query ? { query } : {}) })).data
}

export async function storePost<T>(path: string, body: unknown): Promise<T> {
  return (await storeRequest<T>(path, { ...(await visit()), method: "POST", body })).data
}
