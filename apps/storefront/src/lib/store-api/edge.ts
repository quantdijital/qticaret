import type { Resolution, SiteMaintenance, SiteSeo } from "@qticaret/types"
import { NO_TRACKING, trackingIdsOf } from "../analytics/ids"
import type { TrackingIds } from "../analytics/ids"
import { storefrontEnv } from "../env"
import { storeRequest, storeUrl } from "./core"
import { isNotFound } from "./errors"
import { storeCaches } from "./registry"
import { publishableKey } from "./publishable-key"
import { keepResolution, keptResolution } from "./resolutions"
import { signedVisitorHeaders } from "./visitor"

/**
 * The calls `proxy.ts` makes before a page renders (adr/0046 §4). Not
 * `server-only`: the proxy runs outside React's server environment.
 */

export async function resolveForProxy(
  path: string,
  visitorIp: string | null
): Promise<Resolution | null> {
  const kept = keptResolution(path)
  if (kept) {
    return kept
  }
  try {
    const { data } = await storeRequest<Resolution>("/store/seo/resolve", {
      query: { path },
      visitorIp,
    })
    // The page asks for the same path next (`resolvePath`): it gets this answer
    keepResolution(path, data)
    return data
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

/** Whether the shop is dark (adr/0053) and what its page says. */
export interface EdgeMaintenance {
  enabled: boolean
  title: string | null
  message: string | null
  expectedAt: string | null
  allowPaths: string[]
}

/** What every request's edge needs from the shop's SEO settings (docs/13 §2.2, §6). */
export interface EdgeSite {
  indexing: boolean
  canonicalHost: string | null
  indexNowKey: string | null
  /** For the pages the edge answers itself (maintenance). */
  shopName: string
  maintenance: EdgeMaintenance
  /** The platform suspended the shop (adr/0061 Ek C15): its 503, whatever maintenance says. */
  suspended: boolean
  /** The measurement tags the shop connected: the CSP opens their hosts (docs/20). */
  tracking: TrackingIds
}

const OPEN: EdgeMaintenance = {
  enabled: false,
  title: null,
  message: null,
  expectedAt: null,
  allowPaths: [],
}

const textOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

/** The answer's maintenance block, every field checked; anything but `enabled: true` is open. */
function maintenanceOf(raw: unknown): EdgeMaintenance {
  const maintenance = (raw ?? {}) as Partial<Record<keyof SiteMaintenance, unknown>>
  if (maintenance.enabled !== true) {
    return OPEN
  }
  const paths: unknown[] = Array.isArray(maintenance.allow_paths) ? maintenance.allow_paths : []
  return {
    enabled: true,
    title: textOrNull(maintenance.title),
    message: textOrNull(maintenance.message),
    expectedAt: textOrNull(maintenance.expected_at),
    allowPaths: paths.filter((path): path is string => typeof path === "string"),
  }
}

const SITE_TTL_MS = 60_000

// In the process-wide registry: the refresh route (another bundle) clears it (adr/0048 Ek 2026-11-03)
const edgeCache = storeCaches().edge
const SITE = "site"

const cachedSite = () => edgeCache.get(SITE) as { value: EdgeSite; until: number } | undefined

/** Forgets the site's edge facts: the next request asks the backend again (the refresh signal). */
export function forget(): void {
  edgeCache.delete(SITE)
}

/**
 * The shop's edge facts, asked at most once a minute (turning maintenance
 * on or off shows within that minute, adr/0053). When the backend does not
 * answer, the last answer stands; with none yet, "index, no canonical host,
 * open": an outage never hides the shop nor loops it.
 */
export async function edgeSite(visitorIp: string | null): Promise<EdgeSite> {
  const site = cachedSite()
  if (site && site.until > Date.now()) {
    return site.value
  }
  try {
    const { data } = await storeRequest<
      Omit<SiteSeo, "maintenance"> & { maintenance?: unknown; shop?: { name?: unknown } }
    >("/store/seo/site", { visitorIp })
    const value: EdgeSite = {
      indexing: data.indexing,
      canonicalHost: data.canonical_host,
      indexNowKey: data.indexnow_key,
      shopName: textOrNull(data.shop?.name) ?? "",
      maintenance: maintenanceOf(data.maintenance),
      // Anything but `true` is open: an older backend, a malformed answer
      suspended: data.suspended === true,
      tracking: trackingIdsOf(data.tracking),
    }
    edgeCache.set(SITE, { value, until: Date.now() + SITE_TTL_MS })
    return value
  } catch {
    return (
      cachedSite()?.value ?? {
        indexing: true,
        canonicalHost: null,
        indexNowKey: null,
        shopName: "",
        maintenance: OPEN,
        suspended: false,
        tracking: NO_TRACKING,
      }
    )
  }
}

/** A bypass token's answer: it opens the dark shop, it does not, or the backend did not say. */
export type BypassAnswer = "open" | "closed" | "unknown"

const BYPASS_TTL_MS = 60_000
const BYPASS_MAX_ENTRIES = 500

const bypasses = new Map<string, { answer: BypassAnswer; until: number }>()

function rememberBypass(token: string, answer: BypassAnswer, now: number): void {
  bypasses.set(token, { answer, until: now + BYPASS_TTL_MS })
  if (bypasses.size <= BYPASS_MAX_ENTRIES) {
    return
  }
  for (const [key, entry] of bypasses) {
    if (entry.until <= now || bypasses.size > BYPASS_MAX_ENTRIES) {
      bypasses.delete(key)
    }
  }
}

/**
 * Whether a bypass link's token opens the dark shop (`GET
 * /store/maintenance/bypass/:token`, adr/0053): asked at most once a
 * minute per token in this process. A 204 opens, a 404 closes (the link
 * ended, or the section was saved since); anything else is no answer and
 * not kept, so the page stays dark this once and the cookie stays.
 */
export async function checkBypass(token: string, visitorIp: string | null): Promise<BypassAnswer> {
  const now = Date.now()
  const hit = bypasses.get(token)
  if (hit && hit.until > now) {
    return hit.answer
  }
  try {
    await storeRequest(`/store/maintenance/bypass/${encodeURIComponent(token)}`, {
      visitorIp,
      timeoutMs: 3000,
    })
    rememberBypass(token, "open", now)
    return "open"
  } catch (error) {
    if (isNotFound(error)) {
      rememberBypass(token, "closed", now)
      return "closed"
    }
    return "unknown"
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
