import { SERP_TEXT_LENGTH, fitsSerp } from "../pixel-width"
import { isValidSlug, toSlug } from "../slug"
import { hasSymbolRun, includesFolded, isShouting, repeatedWord, words } from "./text"
import type { AdvisorFacts, IssueFix, PageKind, Rule } from "./types"

/**
 * Rules every page kind shares (docs/14 §3.1, §3.6): search result title
 * and description, slug, focus keyword. Their ids carry the kind's letter
 * (P product, C category, B brand, K collection, A content page and blog
 * post), as the catalog lists them.
 */

export const PREFIX: Record<PageKind, string> = {
  product: "P",
  category: "C",
  brand: "B",
  collection: "K",
  page: "A",
  post: "A",
}

const id = (facts: AdvisorFacts, rule: string) => `${PREFIX[facts.kind]}-${rule}`

// An own text that misses gives way to the template; a template's is edited by hand
const lengthFix = (own: boolean, field: "title" | "description"): IssueFix =>
  own
    ? { kind: "auto", action: `use_template_${field}` }
    : { kind: "manual", action: `edit_${field}` }

const titleLength: Rule = (facts) => {
  const { min, max } = SERP_TEXT_LENGTH.title
  const length = Array.from(facts.title).length
  if (length >= min && length <= max && fitsSerp("title", facts.title)) {
    return null
  }
  return {
    ruleId: id(facts, "TITLE-01"),
    severity: "high",
    category: "meta",
    params: { length, min, max },
    fix: lengthFix(facts.titleIsOwn, "title"),
  }
}

const titleUnique: Rule = (facts) =>
  facts.duplicates.title > 0
    ? {
        ruleId: id(facts, "TITLE-02"),
        severity: "high",
        category: "meta",
        params: { count: facts.duplicates.title },
        fix: { kind: "manual", action: "edit_title" },
      }
    : null

const titleNoise: Rule = (facts) => {
  const repeated = repeatedWord(facts.title)
  const problem = isShouting(facts.title)
    ? "shouting"
    : repeated
      ? "repeated"
      : hasSymbolRun(facts.title)
        ? "symbols"
        : null
  return problem
    ? {
        ruleId: id(facts, "TITLE-03"),
        severity: "medium",
        category: "meta",
        params: { problem, word: repeated ?? "" },
        fix: { kind: "manual", action: "edit_title" },
      }
    : null
}

const descriptionLength: Rule = (facts) => {
  const { min, max } = SERP_TEXT_LENGTH.description
  const length = Array.from(facts.description).length
  if (length >= min && length <= max && fitsSerp("description", facts.description)) {
    return null
  }
  return {
    ruleId: id(facts, "META-01"),
    severity: "medium",
    category: "meta",
    params: { length, min, max },
    fix: lengthFix(facts.descriptionIsOwn, "description"),
  }
}

const descriptionUnique: Rule = (facts) =>
  facts.duplicates.description > 0
    ? {
        ruleId: id(facts, "META-02"),
        severity: "medium",
        category: "meta",
        params: { count: facts.duplicates.description },
        fix: { kind: "manual", action: "edit_description" },
      }
    : null

// docs/13 §2.1: lower-case letters, digits and hyphens, 80 at most, not digits only
const slugForm: Rule = (facts) =>
  isValidSlug(facts.handle)
    ? null
    : {
        ruleId: id(facts, "SLUG-01"),
        severity: "high",
        category: "technical",
        params: { slug: facts.handle },
        fix: { kind: "manual", action: "edit_handle" },
      }

const slugMeaning: Rule = (facts) => {
  const named = toSlug(facts.name)
    .split("-")
    .filter((word) => word.length >= 3)
  const slug = new Set(facts.handle.split("-"))
  return named.length === 0 || named.some((word) => slug.has(word))
    ? null
    : {
        ruleId: id(facts, "SLUG-02"),
        severity: "medium",
        category: "technical",
        params: { slug: facts.handle },
        fix: { kind: "manual", action: "edit_handle" },
      }
}

/** P-KW-01: a focus keyword the shop chose belongs in the title, the description and the start of the text. */
const keywordPlaced: Rule = (facts) => {
  const keyword = facts.focusKeyword?.trim()
  if (!keyword) {
    return null
  }
  const opening = words(facts.body).slice(0, 100).join(" ")
  const missing = [
    includesFolded(facts.title, keyword) ? null : "title",
    includesFolded(facts.description, keyword) ? null : "description",
    includesFolded(opening, keyword) ? null : "body",
  ].filter((place): place is string => place !== null)
  return missing.length > 0
    ? {
        ruleId: id(facts, "KW-01"),
        severity: "medium",
        category: "meta",
        params: { keyword, missing: missing.join(",") },
      }
    : null
}

// The page asked to stay out of search: said once, so its other findings read in context
const noindexNotice: Rule = (facts) =>
  facts.noindex
    ? {
        ruleId: id(facts, "ROBOTS-01"),
        severity: "info",
        category: "technical",
        params: {},
        fix: { kind: "manual", action: "edit_robots" },
      }
    : null

export const SHARED_RULES: readonly Rule[] = [
  titleLength,
  titleUnique,
  titleNoise,
  descriptionLength,
  descriptionUnique,
  slugForm,
  slugMeaning,
  keywordPlaced,
  noindexNotice,
]
