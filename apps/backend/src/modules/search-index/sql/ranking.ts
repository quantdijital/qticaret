import type { ListingPlan } from "../types"
import type { Statement } from "./statement"

/**
 * A search's relevance (adr/0056), for each matched product:
 *
 *   score = (Σ unit scores × found / units + title lift) × (1 + popularity lift)
 *
 * A unit scores its best way of being found: the way's weight × its
 * `ts_rank` over the weighted fields ({D, C, B, A} = {0.15, 0.35, 0.65,
 * 1}: a word in the title counts as much as three in attributes), scaled
 * so one title word is 1. `ts_rank`, not `ts_rank_cd`: each unit is
 * weighed on its own (one word and its forms), where cover density adds
 * nothing, and on PostgreSQL 16 `ts_rank_cd` measured ten times slower
 * (adr/0056 §Performans); nearness is the title lift's. `found / units`
 * scales a product that lacks a unit (a query of three or more needs all
 * but one) below one that has them all. The title lift: +1 when the title
 * is the query, +0.7 when it holds the whole query from a word's start.
 * The popularity lift: up to +30%, by the orders of the last 30 days on a
 * log scale (1 order +7%, 10 +24%). Products in stock come first whatever
 * their score (ORDER BY, listing.ts).
 */

/** `ts_rank` weights for D, C, B, A. */
export const FIELD_WEIGHTS = "{0.15,0.35,0.65,1}"
/** `ts_rank` gives one occurrence of weight 1 as 1 / (π²/6): scaled back to 1. */
export const RANK_SCALE = Math.PI ** 2 / 6
/** A unit scores above this only when found: the least real way is ~0.01. */
export const FOUND_ABOVE = "0.000001"
export const TITLE_EQUALS_LIFT = 1
export const TITLE_HOLDS_LIFT = 0.7
export const POPULARITY_LIFT = { perLog: 0.1, most: 0.3 } as const

export interface Ranking {
  /** The score expression (0 when the plan has no text). */
  score: string
  /** The lateral join that weighs each unit once per product. */
  lateral: string
}

export function ranking(plan: ListingPlan, sql: Statement): Ranking {
  const { text } = plan
  if (!text || text.units.length === 0) {
    return { score: "0::float8", lateral: "" }
  }
  const units = text.units.map((ranks, at) => {
    const ways = ranks.map(
      (rank) =>
        `${sql.param(rank.weight * RANK_SCALE)}::float8 * ts_rank('${FIELD_WEIGHTS}'::float4[], d.document, ${sql.param(rank.query)}::tsquery)`
    )
    return `GREATEST(${ways.join(", ")}) AS r${String(at)}`
  })
  const names = text.units.map((_, at) => `r.r${String(at)}`)
  const sum = names.join(" + ")
  // `ts_rank` gives a product that lacks the unit 1e-20, never 0
  const found = names.map((name) => `(${name} > ${FOUND_ABOVE})::integer`).join(" + ")
  const holds = text.phrase.includes(" ")
    ? `WHEN strpos(' ' || d.title, ${sql.param(` ${text.phrase}`)}) > 0 THEN ${String(TITLE_HOLDS_LIFT)}`
    : ""
  const lift = `CASE WHEN d.title = ${sql.param(text.phrase)} THEN ${String(TITLE_EQUALS_LIFT)} ${holds} ELSE 0 END`
  const popularity = `(1 + LEAST(${String(POPULARITY_LIFT.most)}, ${String(POPULARITY_LIFT.perLog)} * ln(1 + d.popularity)))`
  return {
    score: `((${sum}) * (${found})::float8 / ${String(text.units.length)} + ${lift}) * ${popularity}`,
    // OFFSET 0 keeps the subquery whole: each unit weighed once, however often its score is read
    lateral: `CROSS JOIN LATERAL (SELECT ${units.join(", ")} OFFSET 0) r`,
  }
}
