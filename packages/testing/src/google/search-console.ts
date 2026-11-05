import type { ServerResponse } from "node:http"

/**
 * Search Console and CrUX as Google answers them (F10.11): the properties
 * the account reaches, a sitemap submitted, Search Analytics by page, URL
 * Inspection (each needing `auth/webmasters`), and CrUX's field data with
 * the platform's API key.
 */

const WEBMASTERS = "https://www.googleapis.com/auth/webmasters"

export interface SearchConsoleState {
  /** Search Console (F10.11): the properties the account reaches, with its permission. */
  sites: { siteUrl: string; permissionLevel: string }[]
  /** Search Analytics' rows by page for a period; none unless a test says. */
  searchRows: (range: { startDate: string; endDate: string }) => {
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
  }[]
  /** URL Inspection's verdict by URL; PASS when not named. */
  inspections: Map<string, { verdict: string; coverageState: string }>
  /** URLs inspected, in order. */
  inspected: string[]
  /** Sitemaps submitted, as `<property> <sitemap>`. */
  sitemaps: string[]
  /** CrUX: the API key it takes, and p75 per form factor (none: no data). */
  cruxKey: string
  crux: Map<string, { lcp: number; inp: number; cls: string }>
}

type Json = (res: ServerResponse, status: number, body: unknown) => void

function answerCrux(
  state: SearchConsoleState,
  url: URL,
  body: string,
  json: Json,
  res: ServerResponse
) {
  const refuse = (status: number, word: string) => {
    json(res, status, { error: { code: status, status: word, message: word } })
  }
  if (url.searchParams.get("key") !== state.cruxKey) {
    refuse(400, "INVALID_ARGUMENT")
    return
  }
  const asked = JSON.parse(body) as { formFactor?: string }
  const metrics = state.crux.get(asked.formFactor ?? "")
  if (!metrics) {
    refuse(404, "NOT_FOUND")
    return
  }
  json(res, 200, {
    record: {
      key: asked,
      metrics: {
        largest_contentful_paint: { percentiles: { p75: metrics.lcp } },
        interaction_to_next_paint: { percentiles: { p75: metrics.inp } },
        cumulative_layout_shift: { percentiles: { p75: metrics.cls } },
      },
    },
  })
}

/**
 * Answers a Search Console or CrUX call; false when the path is not one
 * of them. `scope`: what the bearer token was granted (CrUX takes none).
 */
export function answerSearchConsole(
  state: SearchConsoleState,
  method: string,
  url: URL,
  body: string,
  scope: string,
  json: Json,
  res: ServerResponse
): boolean {
  const refuse = (status: number, word: string) => {
    json(res, status, { error: { code: status, status: word, message: word } })
  }
  if (method === "POST" && url.pathname === "/v1/records:queryRecord") {
    answerCrux(state, url, body, json, res)
    return true
  }
  const consoleCall =
    url.pathname.startsWith("/webmasters/v3/") || url.pathname.startsWith("/v1/urlInspection/")
  if (!consoleCall) {
    return false
  }
  if (!scope.split(" ").includes(WEBMASTERS)) {
    refuse(403, "PERMISSION_DENIED")
    return true
  }
  if (method === "GET" && url.pathname === "/webmasters/v3/sites") {
    json(res, 200, { siteEntry: state.sites })
    return true
  }
  const sitePath = /^\/webmasters\/v3\/sites\/([^/]+)\/(.+)$/.exec(url.pathname)
  const site = sitePath?.[1] ? decodeURIComponent(sitePath[1]) : ""
  if (sitePath && !state.sites.some((each) => each.siteUrl === site)) {
    refuse(403, "PERMISSION_DENIED")
    return true
  }
  if (method === "PUT" && sitePath?.[2]?.startsWith("sitemaps/")) {
    state.sitemaps.push(`${site} ${decodeURIComponent(sitePath[2].slice("sitemaps/".length))}`)
    res.writeHead(204).end()
    return true
  }
  if (method === "POST" && sitePath?.[2] === "searchAnalytics/query") {
    const asked = JSON.parse(body) as { startDate: string; endDate: string }
    json(res, 200, { rows: state.searchRows(asked), responseAggregationType: "byPage" })
    return true
  }
  if (method === "POST" && url.pathname === "/v1/urlInspection/index:inspect") {
    const asked = JSON.parse(body) as { inspectionUrl: string; siteUrl: string }
    if (!state.sites.some((each) => each.siteUrl === asked.siteUrl)) {
      refuse(403, "PERMISSION_DENIED")
      return true
    }
    state.inspected.push(asked.inspectionUrl)
    const verdict = state.inspections.get(asked.inspectionUrl) ?? {
      verdict: "PASS",
      coverageState: "Submitted and indexed",
    }
    json(res, 200, {
      inspectionResult: {
        indexStatusResult: { ...verdict, lastCrawlTime: new Date().toISOString() },
      },
    })
    return true
  }
  refuse(404, "NOT_FOUND")
  return true
}
