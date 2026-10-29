import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import type { FieldMetrics, FormFactor, Inspection } from "../../lib/google/search-console"
import type { FieldState, IndexState, PageStat } from "../../lib/seo/insights"
import { FieldMetric } from "./models/field-metric"
import { InsightRun } from "./models/insight-run"
import { SearchPageStat } from "./models/search-page-stat"
import { UrlInspection } from "./models/url-inspection"

export interface PageStatInput {
  path: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  prevClicks: number
  prevImpressions: number
}

/** Search Console's and CrUX's word on the shop, kept for the panel and the audit (F10.11). */
class SeoInsightsModuleService extends MedusaService({
  SearchPageStat,
  UrlInspection,
  FieldMetric,
  InsightRun,
}) {
  /** Replaces the pages' figures with the night's. */
  @InjectTransactionManager()
  async replacePageStats(
    rows: readonly PageStatInput[],
    periodEnd: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const old = await this.listSearchPageStats({}, { select: ["id"] }, sharedContext)
    if (old.length > 0) {
      await this.deleteSearchPageStats(
        old.map(({ id }) => id),
        sharedContext
      )
    }
    if (rows.length > 0) {
      await this.createSearchPageStats(
        rows.map((row) => ({
          path: row.path,
          clicks: Math.round(row.clicks),
          impressions: Math.round(row.impressions),
          ctr_bp: Math.round(row.ctr * 10_000),
          position_x100: Math.round(row.position * 100),
          prev_clicks: Math.round(row.prevClicks),
          prev_impressions: Math.round(row.prevImpressions),
          period_end: periodEnd,
        })),
        sharedContext
      )
    }
  }

  /** The pages' figures as the audit reads them. */
  @InjectManager()
  async pageStats(@MedusaContext() sharedContext: Context = {}): Promise<PageStat[]> {
    const rows = await this.listSearchPageStats({}, {}, sharedContext)
    return rows.map((row) => ({
      path: row.path,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr_bp / 10_000,
      prevClicks: row.prev_clicks,
    }))
  }

  /**
   * Of the paths given, those to inspect next: never inspected first, then
   * the longest ago, none inspected since `before`.
   */
  @InjectManager()
  async inspectionsDue(
    paths: readonly string[],
    before: Date,
    limit: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    const rows = await this.listUrlInspections(
      { path: [...paths] },
      { select: ["path", "inspected_at"] },
      sharedContext
    )
    const last = new Map(rows.map((row) => [row.path, new Date(row.inspected_at).getTime()]))
    return paths
      .filter((path) => (last.get(path) ?? 0) < before.getTime())
      .sort((a, b) => (last.get(a) ?? 0) - (last.get(b) ?? 0))
      .slice(0, limit)
  }

  @InjectTransactionManager()
  async recordInspection(
    path: string,
    result: Inspection,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listUrlInspections(
      { path },
      { take: 1, select: ["id"] },
      sharedContext
    )
    const values = {
      verdict: result.verdict,
      coverage_state: result.coverageState,
      last_crawl_at: result.lastCrawlTime ? new Date(result.lastCrawlTime) : null,
      inspected_at: new Date(),
    }
    if (row) {
      await this.updateUrlInspections({ id: row.id, ...values }, sharedContext)
    } else {
      await this.createUrlInspections({ path, ...values }, sharedContext)
    }
  }

  /** The inspected pages, for the audit: those still in the sitemap, inspected since `since`. */
  @InjectManager()
  async indexStates(
    paths: readonly string[],
    since: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<IndexState[]> {
    const rows = await this.listUrlInspections(
      { path: [...paths], inspected_at: { $gte: since } },
      {},
      sharedContext
    )
    return rows.map((row) => ({
      path: row.path,
      verdict: row.verdict,
      coverageState: row.coverage_state,
    }))
  }

  @InjectTransactionManager()
  async recordField(
    formFactor: FormFactor,
    metrics: FieldMetrics | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listFieldMetrics(
      { form_factor: formFactor },
      { take: 1, select: ["id"] },
      sharedContext
    )
    const values = {
      has_data: metrics !== null,
      lcp_ms: metrics?.lcp === null || !metrics ? null : Math.round(metrics.lcp),
      inp_ms: metrics?.inp === null || !metrics ? null : Math.round(metrics.inp),
      cls_x1000: metrics?.cls === null || !metrics ? null : Math.round(metrics.cls * 1000),
      collected_at: new Date(),
    }
    if (row) {
      await this.updateFieldMetrics({ id: row.id, ...values }, sharedContext)
    } else {
      await this.createFieldMetrics({ form_factor: formFactor, ...values }, sharedContext)
    }
  }

  /** The field data as the audit reads it. */
  @InjectManager()
  async fieldStates(@MedusaContext() sharedContext: Context = {}): Promise<FieldState[]> {
    const rows = await this.listFieldMetrics({ has_data: true }, {}, sharedContext)
    return rows.map((row) => ({
      formFactor: row.form_factor as FieldState["formFactor"],
      lcp: row.lcp_ms,
      inp: row.inp_ms,
      cls: row.cls_x1000 === null ? null : row.cls_x1000 / 1000,
    }))
  }

  @InjectTransactionManager()
  async recordRun(
    kind: "sitemap" | "search" | "inspection" | "crux",
    error: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listInsightRuns({ kind }, { take: 1, select: ["id"] }, sharedContext)
    if (row) {
      await this.updateInsightRuns({ id: row.id, ran_at: new Date(), error }, sharedContext)
    } else {
      await this.createInsightRuns({ kind, ran_at: new Date(), error }, sharedContext)
    }
  }
}

export default SeoInsightsModuleService
