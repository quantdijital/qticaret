import type { Resolution, SiteSeo } from "@qticaret/types"
import { storefrontEnv } from "../env"
import { storeRequest, storeUrl } from "./core"
import { publishableKey } from "./publishable-key"
import { signedVisitorHeaders } from "./visitor"

/**
 * The calls `proxy.ts` makes before a page renders (adr/0046 §4). Not
 * `server-only`: the proxy runs outside React's server environment.
 */

export async function resolveForProxy(
  path: string,
  visitorIp: string | null
): Promise<Resolution | null> {
  try {
    return (await storeRequest<Resolution>("/store/seo/resolve", { query: { path }, visitorIp }))
      .data
  } catch {
    // The page asks again and shows the error there; the proxy only routes
    return null
  }
}

/** A 404 the storefront is about to serve (docs/13 §4); fire and forget. */
export function reportNotFound(
  path: string,
  referrer: string | null,
  visitorIp: string | null
): void {
  storeRequest("/store/seo/not-found", {
    method: "POST",
    body: { path: path.slice(0, 2048), ...(referrer ? { referrer: referrer.slice(0, 2048) } : {}) },
    visitorIp,
    timeoutMs: 3000,
  }).catch(() => undefined)
}

/** What every request's edge needs from the shop's SEO settings (docs/13 §2.2, §6). */
export interface EdgeSite {
  indexing: boolean
  canonicalHost: string | null
  indexNowKey: string | null
}

let site: { value: EdgeSite; until: number } | undefined

/**
 * The shop's edge facts, asked at most once a minute. Unknown counts as
 * "index, no canonical host": an outage never hides the shop nor loops it.
 */
export async function edgeSite(visitorIp: string | null): Promise<EdgeSite> {
  if (site && site.until > Date.now()) {
    return site.value
  }
  try {
    const { data } = await storeRequest<SiteSeo>("/store/seo/site", { visitorIp })
    const value = {
      indexing: data.indexing,
      canonicalHost: data.canonical_host,
      indexNowKey: data.indexnow_key,
    }
    site = { value, until: Date.now() + 60_000 }
    return value
  } catch {
    return { indexing: true, canonicalHost: null, indexNowKey: null }
  }
}

/** A backend-made file (robots.txt, a sitemap, security.txt) passed through as it is. */
export async function backendFileResponse(
  path: string,
  visitorIp: string | null
): Promise<Response> {
  const env = storefrontEnv()
  const upstream = await fetch(storeUrl(path), {
    headers: {
      "x-publishable-api-key": await publishableKey(env),
      ...signedVisitorHeaders(env.STOREFRONT_IP_SECRET, visitorIp),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })
  const headers = new Headers({ "x-content-type-options": "nosniff" })
  for (const name of ["content-type", "cache-control", "last-modified"]) {
    const value = upstream.headers.get(name)
    if (value) {
      headers.set(name, value)
    }
  }
  // A missing file is a plain 404, not the backend's JSON error
  if (!upstream.ok) {
    return new Response("Not found\n", {
      status: upstream.status === 404 ? 404 : 502,
      headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
    })
  }
  return new Response(await upstream.arrayBuffer(), { status: 200, headers })
}
