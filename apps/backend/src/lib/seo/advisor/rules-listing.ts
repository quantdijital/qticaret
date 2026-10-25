import { PREFIX } from "./rules-shared"
import { wordCount } from "./text"
import type { AdvisorFacts, Rule, SeoIssue } from "./types"

/** Category, brand and collection rules (docs/14 §3.6). */

type Listing = NonNullable<AdvisorFacts["listing"]>

const forListing =
  (check: (facts: AdvisorFacts, listing: Listing) => SeoIssue | null): Rule =>
  (facts) =>
    facts.listing ? check(facts, facts.listing) : null

export const MIN_LISTING_WORDS = 100
const MAX_DEPTH = 3

const text = forListing((facts) => {
  const count = wordCount(facts.body)
  return count < MIN_LISTING_WORDS
    ? {
        ruleId: `${PREFIX[facts.kind]}-CONT-01`,
        severity: "medium",
        category: "content",
        params: { words: count, min: MIN_LISTING_WORDS },
        fix: { kind: "manual", action: "edit_body" },
      }
    : null
})

// A live page with nothing to list is thin: noindex or products (docs/13 §7)
const empty = forListing((facts, listing) =>
  listing.products === 0 && !facts.noindex
    ? {
        ruleId: `${PREFIX[facts.kind]}-EMPTY-01`,
        severity: "high",
        category: "content",
        params: {},
        fix: { kind: "manual", action: "add_products" },
      }
    : null
)

const depth = forListing((facts, listing) =>
  facts.kind === "category" && listing.depth > MAX_DEPTH
    ? {
        ruleId: "C-DEPTH-01",
        severity: "low",
        category: "technical",
        params: { depth: listing.depth, max: MAX_DEPTH },
      }
    : null
)

const logo = forListing((facts, listing) =>
  facts.kind === "brand" && !listing.hasLogo
    ? {
        ruleId: "B-LOGO-01",
        severity: "low",
        category: "images",
        params: {},
        fix: { kind: "manual", action: "add_logo" },
      }
    : null
)

export const LISTING_RULES: readonly Rule[] = [text, empty, depth, logo]
