import type { Context, InferTypeOf } from "@medusajs/framework/types"
import {
  InjectManager,
  MedusaContext,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import type Redis from "ioredis"
import { createRedisVersionSource, createVersionedCache } from "../../lib/cache"
import type { VersionedCache } from "../../lib/cache"
import { logger } from "../../lib/logging"
import { createRedisClient } from "../../lib/redis"
import { orderPatterns, prefixesOf } from "../../lib/seo/redirects"
import type { CompiledPatternRule, RedirectRule, RedirectStatus } from "../../lib/seo/redirects"
import { createCounterBuffer } from "./counters"
import type { CounterBuffer, CounterRow } from "./counters"
import { SeoNotFound } from "./models/seo-not-found"
import { SeoRedirect } from "./models/seo-redirect"

export type SeoRedirectRecord = InferTypeOf<typeof SeoRedirect>
export type SeoNotFoundRecord = InferTypeOf<typeof SeoNotFound>

export interface SeoRedirectsModuleOptions {
  /** Shared marker for the pattern rules' cache across processes. */
  redisUrl?: string
  versionKey?: string
  /** How long hit and 404 counts wait in memory before they are written. */
  flushEveryMs?: number
}

// Patterns are tried one by one on every unmatched request; a shop needing
// more has rules a file import should turn into exact ones
export const MAX_PATTERN_RULES = 200
const MAX_BUFFERED_KEYS = 5_000

interface SqlExecutor {
  execute: (sql: string, params?: unknown[]) => Promise<unknown>
}

const executor = (sharedContext: Context): SqlExecutor => sharedContext.manager as SqlExecutor

export const toRedirectRule = (record: SeoRedirectRecord): RedirectRule => ({
  id: record.id,
  source: record.source,
  match: record.match,
  target: record.target,
  status: record.status as RedirectStatus,
  query_policy: record.query_policy,
  query_keep: record.query_keep ?? null,
})

/**
 * Redirect rules and the 404 log (adr/0017). The rules' checks (safe
 * sources and targets, chains, loops) live in the workflows that write
 * here; this service answers which rules may match a path, cheaply.
 */
class SeoRedirectsModuleService extends MedusaService({ SeoRedirect, SeoNotFound }) {
  private readonly patterns: VersionedCache<CompiledPatternRule[]>
  private readonly hits: CounterBuffer
  private readonly notFound: CounterBuffer

  constructor(container: Record<string, unknown>, options: SeoRedirectsModuleOptions = {}) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    const { redisUrl } = options
    let client: Redis | undefined
    const source = redisUrl
      ? createRedisVersionSource(
          () => (client ??= createRedisClient(redisUrl, "seo_redirects")),
          options.versionKey ?? "qt:redirects:version"
        )
      : null
    const env = process.env["NODE_ENV"]
    if (!source && env !== "development" && env !== "test") {
      logger.warn({ event: "seo_redirects.no_shared_version", nodeEnv: env ?? null })
    }
    this.patterns = createVersionedCache({
      name: "seo_redirects",
      source,
      load: () => this.loadPatterns_(),
    })
    const everyMs = options.flushEveryMs ?? 30_000
    this.hits = createCounterBuffer({
      name: "seo_redirects.hits",
      everyMs,
      maxKeys: MAX_BUFFERED_KEYS,
      write: (rows) => this.writeHits_(rows),
    })
    this.notFound = createCounterBuffer({
      name: "seo_redirects.not_found",
      everyMs,
      maxKeys: MAX_BUFFERED_KEYS,
      write: (rows) => this.writeNotFound_(rows),
    })
  }

  @InjectManager()
  protected async loadPatterns_(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<CompiledPatternRule[]> {
    const rows = await this.listSeoRedirects(
      { match: "pattern" },
      { take: MAX_PATTERN_RULES },
      sharedContext
    )
    return orderPatterns(
      rows.map((row) => ({ ...toRedirectRule(row), created_at: row.created_at }))
    )
  }

  /** The exact rule for `path` and the prefix rules above it: one indexed query. */
  @InjectManager()
  async candidatesFor(
    path: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RedirectRule[]> {
    const rows = await this.listSeoRedirects(
      {
        $or: [
          { match: "exact", source: path },
          { match: "prefix", source: prefixesOf(path) },
        ],
      },
      {},
      sharedContext
    )
    return rows.map(toRedirectRule)
  }

  /** Pattern rules in the order they are tried, cached until a rule changes. */
  patternRules(): Promise<CompiledPatternRule[]> {
    return this.patterns.get()
  }

  /** After a rule write: every process reloads the patterns. */
  invalidatePatterns(): Promise<void> {
    return this.patterns.invalidate()
  }

  recordHit(ruleId: string): void {
    this.hits.add(ruleId)
  }

  /** A path that answered 404, with the host of the page that linked to it. */
  recordNotFound(path: string, refererHost: string | null): void {
    this.notFound.add(path, refererHost)
  }

  /** Writes the counts held in memory (tests, shutdown). */
  async flushCounters(): Promise<void> {
    await Promise.all([this.hits.flush(), this.notFound.flush()])
  }

  @InjectManager()
  protected async writeHits_(
    rows: CounterRow[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await executor(sharedContext).execute(
      `UPDATE seo_redirect AS r
          SET hit_count = r.hit_count + v.n, last_hit_at = GREATEST(r.last_hit_at, v.at)
         FROM (VALUES ${rows.map(() => "(?, ?::integer, ?::timestamptz)").join(", ")}) AS v(id, n, at)
        WHERE r.id = v.id`,
      rows.flatMap((row) => [row.key, row.count, row.last])
    )
  }

  @InjectManager()
  protected async writeNotFound_(
    rows: CounterRow[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await executor(sharedContext).execute(
      `INSERT INTO seo_not_found (id, path, hits, first_seen_at, last_seen_at, last_referer_host)
       VALUES ${rows.map(() => "(?, ?, ?, ?, ?, ?)").join(", ")}
       ON CONFLICT (path) WHERE deleted_at IS NULL DO UPDATE SET
         hits = seo_not_found.hits + EXCLUDED.hits,
         last_seen_at = GREATEST(seo_not_found.last_seen_at, EXCLUDED.last_seen_at),
         last_referer_host = COALESCE(EXCLUDED.last_referer_host, seo_not_found.last_referer_host),
         updated_at = now()`,
      rows.flatMap((row) => [
        generateEntityId(undefined, "nf"),
        row.key,
        row.count,
        row.last,
        row.last,
        row.detail,
      ])
    )
  }

  /**
   * Keeps the 404 log small: paths not asked for since `before` go, and of
   * the rest only the `keep` most asked for stay. Returns how many went.
   */
  @InjectManager()
  async pruneNotFound(
    { before, keep }: { before: Date; keep: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const sql = executor(sharedContext)
    const stale = (await sql.execute(
      `DELETE FROM seo_not_found WHERE last_seen_at < ? RETURNING id`,
      [before]
    )) as unknown[]
    const excess = (await sql.execute(
      `DELETE FROM seo_not_found WHERE id IN (
         SELECT id FROM seo_not_found WHERE deleted_at IS NULL
          ORDER BY hits DESC, last_seen_at DESC OFFSET ?
       ) RETURNING id`,
      [keep]
    )) as unknown[]
    return stale.length + excess.length
  }
}

export default SeoRedirectsModuleService
