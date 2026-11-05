import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import type Redis from "ioredis"
import { createRedisVersionSource, createVersionedCache } from "../../lib/cache"
import type { VersionedCache } from "../../lib/cache"
import { createRedisClient } from "../../lib/redis"
import { synonymMap } from "../../lib/search/query"
import type { SynonymMap } from "../../lib/search/query"
import { SearchSynonym } from "./models/search-synonym"
import { analyseWords, matchesAny } from "./sql/analyse"
import type { WordToAnalyse } from "./sql/analyse"
import {
  bumpPopularity,
  deleteDocuments,
  documentIds,
  documentsOf,
  readDocuments,
  refreshWords,
  setPopularity,
  upsertDocuments,
} from "./sql/documents"
import { listingResult, listingStatement } from "./sql/listing"
import { claimPending, finishPending, markPending, pendingCount } from "./sql/pending"
import { readState, writeState } from "./sql/state"
import { indexStatus } from "./sql/status"
import type { IndexStatus } from "./sql/status"
import type {
  AnalysedWord,
  DocumentInput,
  Executor,
  ListingPlan,
  ListingResult,
  PendingClaim,
  StoredDocument,
} from "./types"

export interface SearchIndexModuleOptions {
  /** Where the synonym cache's version marker lives, shared by the tenant's processes. */
  redisUrl?: string
  versionKey?: string
}

const run = (context: Context, transaction = false): Executor =>
  (transaction ? context.transactionManager : context.manager) as Executor

/**
 * The search index (adr/0056). Its rows are written only by the indexing
 * workflow; listings and search read them in one statement each; the
 * synonyms are the shop's, kept in process and reloaded when any process
 * changes them (a Redis marker, as the settings do).
 */
class SearchIndexModuleService extends MedusaService({ SearchSynonym }) {
  private readonly synonyms: VersionedCache<SynonymMap>

  constructor(container: Record<string, unknown>, options: SearchIndexModuleOptions = {}) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    const { redisUrl } = options
    let client: Redis | undefined
    const source = redisUrl
      ? createRedisVersionSource(
          () => (client ??= createRedisClient(redisUrl, "search_index")),
          options.versionKey ?? "qt:search-synonyms:version"
        )
      : null
    this.synonyms = createVersionedCache({
      name: "search_synonyms",
      source,
      maxAgeMs: 60_000,
      load: () => this.loadSynonyms_(),
    })
  }

  @InjectManager()
  protected async loadSynonyms_(@MedusaContext() context: Context = {}): Promise<SynonymMap> {
    const groups = await this.listSearchSynonyms({}, { select: ["terms"], take: null }, context)
    return synonymMap(groups.map((group) => group.terms))
  }

  /** The shop's synonyms as search reads them (cached). */
  async synonymMap(): Promise<SynonymMap> {
    return this.synonyms.get()
  }

  /** After a synonym group is written: every process reads them again. */
  async invalidateSynonyms(): Promise<void> {
    await this.synonyms.invalidate()
  }

  @InjectTransactionManager()
  async writeDocuments(docs: DocumentInput[], @MedusaContext() context: Context = {}) {
    await upsertDocuments(run(context, true), docs)
  }

  @InjectManager()
  async readDocuments(
    productIds: string[],
    @MedusaContext() context: Context = {}
  ): Promise<StoredDocument[]> {
    return readDocuments(run(context), productIds)
  }

  @InjectTransactionManager()
  async removeDocuments(productIds: string[], @MedusaContext() context: Context = {}) {
    await deleteDocuments(run(context, true), productIds)
  }

  @InjectManager()
  async documentsOf(
    of: { category_id: string } | { brand_id: string },
    @MedusaContext() context: Context = {}
  ): Promise<string[]> {
    return documentsOf(run(context), of)
  }

  @InjectManager()
  async documentIds(after: string, take: number, @MedusaContext() context: Context = {}) {
    return documentIds(run(context), after, take)
  }

  @InjectTransactionManager()
  async bumpPopularity(
    productIds: string[],
    delta: number,
    @MedusaContext() context: Context = {}
  ): Promise<void> {
    await bumpPopularity(run(context, true), productIds, delta)
  }

  @InjectTransactionManager()
  async setPopularity(
    counts: Record<string, number>,
    @MedusaContext() context: Context = {}
  ): Promise<number> {
    return setPopularity(run(context, true), counts)
  }

  @InjectTransactionManager()
  async refreshWords(@MedusaContext() context: Context = {}): Promise<number> {
    return refreshWords(run(context, true))
  }

  @InjectTransactionManager()
  async markPending(productIds: string[], @MedusaContext() context: Context = {}) {
    await markPending(run(context, true), productIds)
  }

  @InjectTransactionManager()
  async claimPending(
    limit: number,
    @MedusaContext() context: Context = {}
  ): Promise<PendingClaim[]> {
    return claimPending(run(context, true), limit)
  }

  @InjectTransactionManager()
  async finishPending(claims: PendingClaim[], @MedusaContext() context: Context = {}) {
    await finishPending(run(context, true), claims)
  }

  @InjectManager()
  async pendingCount(@MedusaContext() context: Context = {}): Promise<number> {
    return pendingCount(run(context))
  }

  /** What the upkeep compared last under `key`; null before the first time. */
  @InjectManager()
  async readState(key: string, @MedusaContext() context: Context = {}): Promise<string | null> {
    return readState(run(context), key)
  }

  @InjectTransactionManager()
  async writeState(key: string, value: string, @MedusaContext() context: Context = {}) {
    await writeState(run(context, true), key, value)
  }

  /** What the index holds now: rows, the queue, the dictionary, the synonyms (the panel). */
  @InjectManager()
  async indexStatus(@MedusaContext() context: Context = {}): Promise<IndexStatus> {
    return indexStatus(run(context))
  }

  /** A query's words: stems, the catalogue's spelling, roots, typo neighbours. */
  @InjectTransactionManager()
  async analyseWords(
    words: WordToAnalyse[],
    @MedusaContext() context: Context = {}
  ): Promise<AnalysedWord[]> {
    return analyseWords(run(context, true), words)
  }

  @InjectManager()
  async matchesAny(
    queries: string[],
    channels: string[] | null,
    @MedusaContext() context: Context = {}
  ): Promise<boolean[]> {
    return matchesAny(run(context), queries, channels)
  }

  /** A listing's or a search's page, count, facets and chips (one statement). */
  @InjectManager()
  async listing(plan: ListingPlan, @MedusaContext() context: Context = {}): Promise<ListingResult> {
    const { sql, params } = listingStatement(plan)
    const [row] = (await run(context).execute(sql, params)) as Parameters<typeof listingResult>[1][]
    return listingResult(plan, row)
  }

  /** The listing statement's plan in PostgreSQL's words (the ADR's EXPLAIN, tests). */
  @InjectManager()
  async explainListing(plan: ListingPlan, @MedusaContext() context: Context = {}) {
    const { sql, params } = listingStatement(plan)
    const rows = (await run(context).execute(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, params)) as {
      "QUERY PLAN": string
    }[]
    return rows.map((row) => row["QUERY PLAN"])
  }
}

export default SearchIndexModuleService
