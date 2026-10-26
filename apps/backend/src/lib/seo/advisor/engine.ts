import { CONTENT_RULES } from "./rules-content"
import { LANDING_RULES } from "./rules-landing"
import { LISTING_RULES } from "./rules-listing"
import { PRODUCT_RULES } from "./rules-product"
import { SHARED_RULES } from "./rules-shared"
import { CATEGORY_WEIGHTS, SEVERITIES } from "./types"
import type { AdvisorFacts, Category, PageKind, SeoIssue, Severity } from "./types"

/**
 * Runs the rules and scores the page (docs/14 §2). Each finding takes a
 * share of its category's weight by severity; a critical one empties the
 * category; a category never goes below zero. The score is what is left
 * out of the weights that apply to the page's kind, 0–100. Deterministic:
 * the same facts give the same findings in the same order and the same score.
 */

// A finding's share of its category, by severity
const PENALTY: Record<Severity, number> = {
  critical: 1,
  high: 0.5,
  medium: 0.25,
  low: 0.1,
  info: 0,
}

// What a kind of page can be judged on; a brand's images are its logo
const APPLICABLE: Record<PageKind, readonly Category[]> = {
  product: ["structured", "meta", "images", "content", "links", "technical"],
  category: ["meta", "content", "technical"],
  collection: ["meta", "content", "technical"],
  brand: ["meta", "images", "content", "technical"],
  // F3.16: their structured data is built for them, so it is not judged
  page: ["meta", "images", "content", "links", "technical"],
  post: ["meta", "images", "content", "links", "technical"],
  landing: ["meta", "content", "technical"],
}

export const GRADES = ["excellent", "good", "needs_work", "poor"] as const
export type Grade = (typeof GRADES)[number]

export function gradeOf(score: number): Grade {
  return score >= 90 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "needs_work" : "poor"
}

export interface Assessment {
  score: number
  grade: Grade
  /** Most severe first, then by rule id. */
  issues: SeoIssue[]
  /** What each applicable category keeps of its weight. */
  categories: Partial<Record<Category, number>>
}

export function findIssues(facts: AdvisorFacts): SeoIssue[] {
  const own =
    facts.kind === "product"
      ? PRODUCT_RULES
      : facts.kind === "page" || facts.kind === "post"
        ? CONTENT_RULES
        : facts.kind === "landing"
          ? LANDING_RULES
          : LISTING_RULES
  const rules = [...SHARED_RULES, ...own]
  return rules
    .map((rule) => rule(facts))
    .filter((issue): issue is SeoIssue => issue !== null)
    .sort(
      (a, b) =>
        SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
        a.ruleId.localeCompare(b.ruleId)
    )
}

export function scoreIssues(kind: PageKind, issues: readonly SeoIssue[]): Assessment {
  const applicable = APPLICABLE[kind]
  const categories: Partial<Record<Category, number>> = {}
  let kept = 0
  let total = 0
  for (const category of applicable) {
    const weight = CATEGORY_WEIGHTS[category]
    const lost = Math.min(
      1,
      issues
        .filter((issue) => issue.category === category)
        .reduce((sum, issue) => sum + PENALTY[issue.severity], 0)
    )
    categories[category] = Math.round(weight * (1 - lost) * 10) / 10
    kept += weight * (1 - lost)
    total += weight
  }
  const score = Math.round((kept / total) * 100)
  return { score, grade: gradeOf(score), issues: [...issues], categories }
}

export const assess = (facts: AdvisorFacts): Assessment =>
  scoreIssues(facts.kind, findIssues(facts))
