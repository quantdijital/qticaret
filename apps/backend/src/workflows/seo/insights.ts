import type { MedusaContainer } from "@medusajs/framework/types"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { isProviderError } from "../../lib/errors"
import { googleApi } from "../../lib/google/client"
import { SEARCH_CONSOLE_SCOPE, googleClientOf } from "../../lib/google/oauth"
import { cruxApiKey, searchConsoleApi } from "../../lib/google/search-console"
import type { SearchRow } from "../../lib/google/search-console"
import { errorSummary, logger } from "../../lib/logging"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { SEO_INSIGHTS_MODULE } from "../../modules/seo-insights"
import type SeoInsightsModuleService from "../../modules/seo-insights/service"
import type { PageStatInput } from "../../modules/seo-insights/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { brandOf } from "../messaging/brand"

type Container = Pick<MedusaContainer, "resolve">

const DAY = 24 * 60 * 60 * 1000
/** Pages inspected a night: well under Search Console's 2,000 a property a day. */
const INSPECTION_BUDGET = 100
/** A page is inspected again after this long. */
const REINSPECT_DAYS = 30
/** Sitemap pages considered for inspection and for the audit. */
const SITEMAP_PAGES = 5000

const day = (time: number): string => new Date(time).toISOString().slice(0, 10)

/**
 * The last 28 days Search Console has final figures for (it reports about
 * two days late), and the 28 before.
 */
export function searchPeriods(now: Date) {
  const end = now.getTime() - 3 * DAY
  const start = end - 27 * DAY
  return {
    current: { startDate: day(start), endDate: day(end) },
    previous: { startDate: day(start - 28 * DAY), endDate: day(start - DAY) },
  }
}

/** The pages the sitemap lists that matter most: products and categories. */
export async function sitemapPaths(container: Container): Promise<string[]> {
  const entries = await container
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        status: "active",
        entity_type: [CATALOG_ENTITY_TYPES.product, CATALOG_ENTITY_TYPES.category],
      },
      { select: ["path"], take: SITEMAP_PAGES }
    )
  return entries.map((entry) => entry.path)
}

const pathOf = (page: string): string | null => {
  try {
    return new URL(page).pathname
  } catch {
    return null
  }
}

/** Both periods' rows by path; a page with query strings adds up under its path. */
function merge(current: readonly SearchRow[], previous: readonly SearchRow[]): PageStatInput[] {
  const pages = new Map<string, PageStatInput & { positionWeight: number }>()
  const entry = (path: string) => {
    const found = pages.get(path)
    if (found) {
      return found
    }
    const fresh = {
      path,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      prevClicks: 0,
      prevImpressions: 0,
      positionWeight: 0,
    }
    pages.set(path, fresh)
    return fresh
  }
  for (const row of current) {
    const path = pathOf(row.page)
    if (path) {
      const page = entry(path)
      page.clicks += row.clicks
      page.impressions += row.impressions
      page.positionWeight += row.position * row.impressions
    }
  }
  for (const row of previous) {
    const path = pathOf(row.page)
    if (path) {
      const page = entry(path)
      page.prevClicks += row.clicks
      page.prevImpressions += row.impressions
    }
  }
  return [...pages.values()].map(({ positionWeight, ...page }) => ({
    ...page,
    ctr: page.impressions > 0 ? page.clicks / page.impressions : 0,
    position: page.impressions > 0 ? positionWeight / page.impressions : 0,
  }))
}

/** Runs one part, recording how it went; one part's failure leaves the others to run. */
async function part(
  insights: SeoInsightsModuleService,
  kind: "sitemap" | "search" | "inspection" | "crux",
  run: () => Promise<void>
): Promise<boolean> {
  try {
    await run()
    await insights.recordRun(kind, null)
    return true
  } catch (error) {
    logger.warn({ event: "seo_insights.part_failed", kind, err: errorSummary(error) })
    await insights.recordRun(kind, isProviderError(error) ? error.providerCode : "failed")
    return false
  }
}

/**
 * What Search Console says of the shop, with its own Google account
 * (F10.11, docs/13 §10): the sitemap submitted, the last 28 days by page
 * beside the 28 before, and the next sitemap pages inspected, within a
 * daily budget. Nothing without the connection, the Search Console
 * scope, a property or a storefront domain. Nothing to undo: it reads,
 * and submitting a sitemap again changes nothing.
 */
const collectSearchConsoleStep = createStep(
  "seo-collect-search-console",
  async (input: { now: string }, { container }) => {
    const client = googleClientOf()
    const account = await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("google")
    const refreshToken = account?.secrets["refresh_token"]
    const site = account?.settings["gsc_site"]
    const scopes = account?.settings["scopes"]
    const { storefrontUrl } = await brandOf(container)
    if (
      !client ||
      !refreshToken ||
      typeof site !== "string" ||
      typeof scopes !== "string" ||
      !scopes.split(" ").includes(SEARCH_CONSOLE_SCOPE) ||
      !storefrontUrl
    ) {
      return new StepResponse({ ran: false, inspected: 0 })
    }
    const insights = container.resolve<SeoInsightsModuleService>(SEO_INSIGHTS_MODULE)
    const api = searchConsoleApi()
    const now = new Date(input.now)
    let token: string
    try {
      token = await googleApi().accessToken(client, refreshToken)
    } catch (error) {
      await insights.recordRun("search", isProviderError(error) ? error.providerCode : "failed")
      return new StepResponse({ ran: false, inspected: 0 })
    }
    await part(insights, "sitemap", () =>
      api.submitSitemap(token, site, `${storefrontUrl}/sitemap.xml`)
    )
    await part(insights, "search", async () => {
      const periods = searchPeriods(now)
      const [current, previous] = await Promise.all([
        api.pageStats(token, site, periods.current),
        api.pageStats(token, site, periods.previous),
      ])
      await insights.replacePageStats(merge(current, previous), periods.current.endDate)
    })
    let inspected = 0
    await part(insights, "inspection", async () => {
      const due = await insights.inspectionsDue(
        await sitemapPaths(container),
        new Date(now.getTime() - REINSPECT_DAYS * DAY),
        INSPECTION_BUDGET
      )
      for (const path of due) {
        await insights.recordInspection(
          path,
          await api.inspect(token, site, `${storefrontUrl}${path}`)
        )
        inspected += 1
      }
    })
    return new StepResponse({ ran: true, inspected })
  }
)

/**
 * The shop's Core Web Vitals from Chrome's users (CrUX), on phones and
 * desktops, with the platform's API key: nothing without it or a domain.
 */
const collectFieldDataStep = createStep(
  "seo-collect-field-data",
  async (_input: { now: string }, { container }) => {
    const key = cruxApiKey()
    const { storefrontUrl } = await brandOf(container)
    if (!key || !storefrontUrl) {
      return new StepResponse({ ran: false })
    }
    const insights = container.resolve<SeoInsightsModuleService>(SEO_INSIGHTS_MODULE)
    const api = searchConsoleApi()
    const ran = await part(insights, "crux", async () => {
      for (const formFactor of ["PHONE", "DESKTOP"] as const) {
        await insights.recordField(formFactor, await api.fieldData(key, storefrontUrl, formFactor))
      }
    })
    return new StepResponse({ ran })
  }
)

/** The nightly insights (F10.11): Search Console, then CrUX. */
export const collectSeoInsightsWorkflow = createWorkflow(
  "seo-collect-insights",
  (input: { now: string }) => {
    const search = collectSearchConsoleStep(input)
    const field = collectFieldDataStep(input)
    return new WorkflowResponse({ search, field })
  }
)
