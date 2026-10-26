import { ORIGINALITY } from "../../content/originality"
import type { AdvisorFacts, Rule, SeoIssue } from "./types"

/**
 * Facet landing page rules (docs/14 §3.7): programmatic pages must stand
 * on their own (Google's scaled content abuse policy). Originality under
 * 30% is not published at all; under 40% is critical here. docs/14's
 * L-EMPTY-01 is L-PRODUCTS-01: the panel words a rule by its name, and
 * EMPTY-01 says "no products" for listings.
 */

type Landing = NonNullable<AdvisorFacts["landing"]>

const forLanding =
  (check: (facts: AdvisorFacts, landing: Landing) => SeoIssue | null): Rule =>
  (facts) =>
    facts.landing ? check(facts, facts.landing) : null

export const MIN_LANDING_WORDS = 300
export const MIN_ORIGINALITY = ORIGINALITY.warn
export const MIN_LANDING_PRODUCTS = 3
// A batch: what went live in the last two weeks
export const BATCH_DAYS = 14
export const MAX_BATCH = 100
export const MIN_REVIEWED_SHARE = 0.05

const unique = forLanding((_facts, landing) =>
  landing.originality < MIN_ORIGINALITY
    ? {
        ruleId: "L-UNIQ-01",
        severity: "critical",
        category: "content",
        params: { originality: landing.originality, min: MIN_ORIGINALITY },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

const length = forLanding((_facts, landing) =>
  landing.words < MIN_LANDING_WORDS
    ? {
        ruleId: "L-TEXT-01",
        severity: "high",
        category: "content",
        params: { words: landing.words, min: MIN_LANDING_WORDS },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
)

// A page listing almost nothing is thin: noindex until it has products (docs/13 §7)
const empty = forLanding((facts, landing) =>
  landing.products < MIN_LANDING_PRODUCTS && !facts.noindex
    ? {
        ruleId: "L-PRODUCTS-01",
        severity: "high",
        category: "content",
        params: { products: landing.products, min: MIN_LANDING_PRODUCTS },
        fix: { kind: "manual", action: "edit_robots" },
      }
    : null
)

const batch = forLanding((_facts, landing) =>
  landing.recent && landing.batchSize > MAX_BATCH
    ? {
        ruleId: "L-BATCH-01",
        severity: "high",
        category: "technical",
        params: { count: landing.batchSize, max: MAX_BATCH, days: BATCH_DAYS },
      }
    : null
)

const review = forLanding((_facts, landing) =>
  landing.recent && !landing.reviewed && landing.batchReviewedShare < MIN_REVIEWED_SHARE
    ? {
        ruleId: "L-REVIEW-01",
        severity: "medium",
        category: "content",
        params: {
          share: Math.round(landing.batchReviewedShare * 100),
          min: MIN_REVIEWED_SHARE * 100,
        },
        fix: { kind: "manual", action: "mark_reviewed" },
      }
    : null
)

export const LANDING_RULES: readonly Rule[] = [unique, length, empty, batch, review]
