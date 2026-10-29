import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { SearchTermDay } from "./models/search-term-day"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface TermCount {
  term: string
  searches: number
  zero_results: number
}

/** Storefront search terms by day (F11.8): counted, ranked, kept 180 days. */
class SearchTermsModuleService extends MedusaService({ SearchTermDay }) {
  /** One search of `term` on `day`, and whether it found nothing; one statement, safe at once. */
  @InjectTransactionManager()
  async record(
    day: string,
    term: string,
    found: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    const zero = found === 0 ? 1 : 0
    await manager.execute(
      `INSERT INTO search_term_day (id, day, term, searches, zero_results, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, now(), now())
       ON CONFLICT (day, term) WHERE deleted_at IS NULL
       DO UPDATE SET searches = search_term_day.searches + 1,
                     zero_results = search_term_day.zero_results + EXCLUDED.zero_results,
                     updated_at = now()`,
      [generateEntityId(undefined, "stday"), day, term, zero]
    )
  }

  /**
   * Terms of the days from `from` to `to` (both included), the most
   * searched first; `zeroOnly` keeps those that found nothing at least once.
   */
  @InjectManager()
  async ranked(
    from: string,
    to: string,
    options: { limit: number; zeroOnly?: boolean },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TermCount[]> {
    const manager = sharedContext.manager as Executor
    const order = options.zeroOnly
      ? "zero_results DESC, searches DESC"
      : "searches DESC, zero_results DESC"
    return (await manager.execute(
      `SELECT term, sum(searches)::integer AS searches, sum(zero_results)::integer AS zero_results
         FROM search_term_day
        WHERE deleted_at IS NULL AND day >= ? AND day <= ?
        GROUP BY term
       ${options.zeroOnly ? "HAVING sum(zero_results) > 0" : ""}
        ORDER BY ${order}, term LIMIT ?`,
      [from, to, options.limit]
    )) as TermCount[]
  }

  /** The days' totals: searches, ones that found nothing, distinct terms and those that found nothing. */
  @InjectManager()
  async totals(
    from: string,
    to: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ searches: number; zero_results: number; terms: number; zero_terms: number }> {
    const manager = sharedContext.manager as Executor
    const [row] = (await manager.execute(
      `SELECT coalesce(sum(searches), 0)::integer AS searches,
              coalesce(sum(zero_results), 0)::integer AS zero_results,
              count(DISTINCT term)::integer AS terms,
              (count(DISTINCT term) FILTER (WHERE zero_results > 0))::integer AS zero_terms
         FROM search_term_day WHERE deleted_at IS NULL AND day >= ? AND day <= ?`,
      [from, to]
    )) as { searches: number; zero_results: number; terms: number; zero_terms: number }[]
    return row ?? { searches: 0, zero_results: 0, terms: 0, zero_terms: 0 }
  }

  /** Days before `day` go (adr/0039 §8: 180 days are kept). */
  @InjectTransactionManager()
  async prune(day: string, @MedusaContext() sharedContext: Context = {}): Promise<number> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(`DELETE FROM search_term_day WHERE day < ? RETURNING id`, [
      day,
    ])) as unknown[]
    return rows.length
  }
}

export default SearchTermsModuleService
