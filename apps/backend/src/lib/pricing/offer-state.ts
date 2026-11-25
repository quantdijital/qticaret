import { createHash } from "node:crypto"
import { offerOf } from "./offers"
import type { PromotionRow, RuleRow, When } from "./offers"

/**
 * The automatic promotions that are a price (adr/0023 Ek 2026-11-05) as
 * they stand now, in one key: each one's code, what it takes, from when,
 * which products it targets, and whether it can apply now (inside its
 * campaign's dates). The search index's minute job compares it with the
 * last one it noted: what no event tells of (a campaign beginning or
 * ending) marks every product to be indexed again, so `on_sale` follows.
 * A promotion with a budget or a limit of uses is no price (`offerOf`,
 * adr/0076 Ek 2026-11-25), so its uses never change the key. Pure.
 */

/** A promotion as the minute job reads it: `PromotionRow` with its targets and dates. */
export interface PromotionStateRow extends PromotionRow {
  application_method?:
    | (NonNullable<PromotionRow["application_method"]> & {
        target_rules?: (RuleRow | null)[] | null
      })
    | null
  campaign?:
    | (NonNullable<PromotionRow["campaign"]> & {
        ends_at?: When
      })
    | null
}

const timeOf = (when: When): number | null => {
  const at = when ? new Date(when).getTime() : Number.NaN
  return Number.isFinite(at) ? at : null
}

function appliesNow(row: PromotionStateRow, now: Date): boolean {
  const starts = timeOf(row.campaign?.starts_at)
  const ends = timeOf(row.campaign?.ends_at)
  const at = now.getTime()
  return (starts === null || starts <= at) && (ends === null || ends > at)
}

/** A rule as text, its values sorted: the same targets read the same whatever their order. */
const ruleText = (rule: RuleRow): string =>
  [
    rule.attribute ?? "",
    rule.operator ?? "",
    ...(rule.values ?? []).flatMap((each) => (each?.value ? [each.value] : [])).sort(),
  ].join("\u0001")

/** The key of the price offers in `currency` at `now`; the same promotions give the same key. */
export function offerState(
  rows: readonly PromotionStateRow[],
  currency: string,
  now: Date
): string {
  const entries = rows.flatMap((row) => {
    const offer = offerOf(row, currency)
    if (offer?.kind !== "price") {
      return []
    }
    const targets = (row.application_method?.target_rules ?? [])
      .flatMap((rule) => (rule ? [ruleText(rule)] : []))
      .sort()
    return [
      {
        code: offer.code,
        method: offer.method,
        since: offer.since.toISOString(),
        target: row.application_method?.target_type ?? null,
        targets,
        applies: appliesNow(row, now),
      },
    ]
  })
  entries.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex")
}
