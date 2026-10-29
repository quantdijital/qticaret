import { z } from "@medusajs/framework/zod"
import { createHttpClient } from "../clients"
import type { HttpClient, HttpClientOptions } from "../clients"
import { isProviderError } from "../errors"
import { parseEnv } from "../env"
import { GOOGLE_PROVIDER, googleHosts } from "./oauth"

/**
 * Search Console and CrUX for the shop's SEO (F10.11, docs/13 §10),
 * checked against their references: the properties the connected account
 * reaches, a sitemap submitted, Search Analytics by page, URL Inspection,
 * and the field data of Chrome's users. CrUX is read with the platform's
 * API key (`CRUX_API_KEY`); the rest with the shop's own Google token.
 */

const apiError = (body: unknown): string | undefined => {
  const status = (body as { error?: { status?: unknown } } | null)?.error?.status
  return typeof status === "string" ? status : undefined
}

export interface SearchRow {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface Inspection {
  /** PASS, PARTIAL, FAIL, NEUTRAL. */
  verdict: string
  coverageState: string | null
  lastCrawlTime: string | null
}

export type FormFactor = "PHONE" | "DESKTOP"

/** p75 of a form factor's page loads: LCP and INP in ms, CLS as a number. */
export interface FieldMetrics {
  lcp: number | null
  inp: number | null
  cls: number | null
}

const Sites = z.looseObject({
  siteEntry: z
    .array(z.looseObject({ siteUrl: z.string(), permissionLevel: z.string() }))
    .optional(),
})

const Rows = z.looseObject({
  rows: z
    .array(
      z.looseObject({
        keys: z.array(z.string()),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
        position: z.number(),
      })
    )
    .optional(),
})

const InspectionAnswer = z.looseObject({
  inspectionResult: z.looseObject({
    indexStatusResult: z
      .looseObject({
        verdict: z.string().optional(),
        coverageState: z.string().optional(),
        lastCrawlTime: z.string().optional(),
      })
      .optional(),
  }),
})

const Percentile = z
  .looseObject({ percentiles: z.looseObject({ p75: z.union([z.number(), z.string()]) }) })
  .optional()

const CruxAnswer = z.looseObject({
  record: z.looseObject({
    metrics: z.looseObject({
      largest_contentful_paint: Percentile,
      interaction_to_next_paint: Percentile,
      cumulative_layout_shift: Percentile,
    }),
  }),
})

const p75 = (metric: z.infer<typeof Percentile>): number | null => {
  const value = metric ? Number(metric.percentiles.p75) : NaN
  return Number.isFinite(value) ? value : null
}

export function createSearchConsoleApi(
  options: Partial<Omit<HttpClientOptions, "provider" | "baseUrl">> = {}
) {
  const hosts = googleHosts()
  const client = (baseUrl: string): HttpClient =>
    createHttpClient({ ...options, baseUrl, provider: GOOGLE_PROVIDER, errorCode: apiError })
  const webmasters = client(hosts.webmasters)
  const searchConsole = client(hosts.searchConsole)
  const crux = client(hosts.crux)
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

  /** The Search Console properties the account reaches, with its permission on each. */
  async function listSites(token: string): Promise<{ siteUrl: string; permission: string }[]> {
    const answer = await webmasters.request({
      method: "GET",
      path: ["webmasters", "v3", "sites"],
      headers: bearer(token),
      schema: Sites,
    })
    return (answer.siteEntry ?? []).map((entry) => ({
      siteUrl: entry.siteUrl,
      permission: entry.permissionLevel,
    }))
  }

  /** Tells Search Console where the shop's sitemap is; sent again it changes nothing. */
  async function submitSitemap(token: string, site: string, sitemapUrl: string): Promise<void> {
    await webmasters.request({
      method: "PUT",
      path: ["webmasters", "v3", "sites", site, "sitemaps", sitemapUrl],
      headers: bearer(token),
      idempotent: true,
      textAnswer: true,
      schema: z.string(),
    })
  }

  /** Clicks, impressions, CTR and position by page over the days given (`YYYY-MM-DD`). */
  async function pageStats(
    token: string,
    site: string,
    range: { startDate: string; endDate: string },
    rowLimit = 5000
  ): Promise<SearchRow[]> {
    const answer = await webmasters.request({
      method: "POST",
      path: ["webmasters", "v3", "sites", site, "searchAnalytics", "query"],
      headers: bearer(token),
      json: { ...range, dimensions: ["page"], rowLimit, dataState: "final" },
      idempotent: true,
      schema: Rows,
    })
    return (answer.rows ?? []).flatMap((row) =>
      row.keys[0]
        ? [
            {
              page: row.keys[0],
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            },
          ]
        : []
    )
  }

  /** Whether Google has the page in its index, as URL Inspection says. */
  async function inspect(token: string, site: string, url: string): Promise<Inspection> {
    const answer = await searchConsole.request({
      method: "POST",
      path: "/v1/urlInspection/index:inspect",
      headers: bearer(token),
      json: { inspectionUrl: url, siteUrl: site, languageCode: "tr-TR" },
      idempotent: true,
      schema: InspectionAnswer,
    })
    const status = answer.inspectionResult.indexStatusResult
    return {
      verdict: status?.verdict ?? "VERDICT_UNSPECIFIED",
      coverageState: status?.coverageState ?? null,
      lastCrawlTime: status?.lastCrawlTime ?? null,
    }
  }

  /** The origin's p75 field data for a form factor; null when CrUX has too little of it. */
  async function fieldData(
    apiKey: string,
    origin: string,
    formFactor: FormFactor
  ): Promise<FieldMetrics | null> {
    try {
      const answer = await crux.request({
        method: "POST",
        path: "/v1/records:queryRecord",
        query: { key: apiKey },
        json: {
          origin,
          formFactor,
          metrics: [
            "largest_contentful_paint",
            "interaction_to_next_paint",
            "cumulative_layout_shift",
          ],
        },
        idempotent: true,
        logPath: "/v1/records:queryRecord",
        schema: CruxAnswer,
      })
      const metrics = answer.record.metrics
      return {
        lcp: p75(metrics.largest_contentful_paint),
        inp: p75(metrics.interaction_to_next_paint),
        cls: p75(metrics.cumulative_layout_shift),
      }
    } catch (error) {
      if (isProviderError(error) && ["NOT_FOUND", "http_404"].includes(error.providerCode)) {
        return null
      }
      throw error
    }
  }

  return { listSites, submitSitemap, pageStats, inspect, fieldData }
}

export type SearchConsoleApi = ReturnType<typeof createSearchConsoleApi>

let shared: { key: string; api: SearchConsoleApi } | undefined

/** One client per set of hosts (a fake server's in tests). */
export function searchConsoleApi(): SearchConsoleApi {
  const key = JSON.stringify(googleHosts())
  if (shared?.key !== key) {
    shared = { key, api: createSearchConsoleApi() }
  }
  return shared.api
}

/** The platform's CrUX API key; null until set. */
export const cruxApiKey = (): string | null => parseEnv().CRUX_API_KEY ?? null
