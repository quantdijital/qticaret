import type { Severity } from "./advisor"
import { hasOwnGroup, isCrawlable, parseRobots } from "./robots-match"

/**
 * Store-wide SEO checks (docs/14 §3.9) as pure functions of what the audit
 * job gathered. A finding counts what it found and keeps some of it to
 * show; each item says which check of the rule found it (`reason`), so the
 * panel can word it.
 */

export const AUDIT_RULES = {
  "S-HOST-01": "critical",
  "S-ROBOTS-01": "critical",
  "S-SITEMAP-01": "high",
  "S-404-01": "high",
  "S-DUP-01": "high",
  "S-ORPHAN-01": "high",
  "S-REDIR-01": "medium",
  "S-IMG-01": "medium",
  // F10.11: from Search Console and CrUX
  "S-GSC-01": "high",
  "S-CWV-01": "high",
  // F11.8: storefront searches that found nothing
  "S-SEARCH-01": "info",
} as const satisfies Record<string, Severity>
export type AuditRuleId = keyof typeof AUDIT_RULES

export type AuditEntityKind =
  "product" | "category" | "brand" | "collection" | "page" | "post" | "landing"

export interface AuditItem {
  reason: string
  /** What it is about: a path, a page's name, a robots.txt line. */
  subject: string
  /** A number it is about: hits, pages sharing a text, URLs. */
  count?: number | undefined
  /** Where it points or should: a redirect's target, a suggested page, a crawler. */
  target?: string | undefined
  /** The page to open for it. */
  entity?: { kind: AuditEntityKind; id: string } | undefined
}

export interface AuditFinding {
  ruleId: AuditRuleId
  severity: Severity
  count: number
  items: AuditItem[]
}

/** A rule's finding from its items; `count` when they are a sample of more. */
export function finding(
  ruleId: AuditRuleId,
  items: readonly AuditItem[],
  count = items.length
): AuditFinding | null {
  return count > 0 ? { ruleId, severity: AUDIT_RULES[ruleId], count, items: [...items] } : null
}

/**
 * S-HOST-01: a live shop has a canonical host and is open to search
 * engines; a staging copy is closed to them (and needs no host).
 */
export function hostFinding(facts: {
  host: string | null
  isIndexingOn: boolean
  isStaging: boolean
}): AuditFinding | null {
  if (facts.isStaging) {
    return facts.isIndexingOn
      ? finding("S-HOST-01", [{ reason: "staging_indexed", subject: "SEO_INDEXING" }])
      : null
  }
  return finding("S-HOST-01", [
    ...(facts.host ? [] : [{ reason: "no_host", subject: "canonical_host" }]),
    ...(facts.isIndexingOn ? [] : [{ reason: "indexing_off", subject: "SEO_INDEXING" }]),
  ])
}

// The search crawlers whose own groups are checked; others follow `*`
const SEARCH_CRAWLERS = { googlebot: "Googlebot", bingbot: "Bingbot" } as const

/**
 * S-ROBOTS-01: every crawler, and Google's and Bing's own rules if the
 * file has any, may crawl the home page and a page of each kind
 * (`pages`, sample paths in the shop's URL style, a landing page's too);
 * no crawler may crawl a filtered or sorted listing (`facets`, docs/13
 * §7); the file names the sitemap once there is a host to name it at.
 */
export function robotsFinding(
  robots: string,
  hasHost: boolean,
  pages: readonly string[],
  facets: readonly string[] = []
): AuditFinding | null {
  const groups = parseRobots(robots)
  const items: AuditItem[] = []
  for (const path of pages) {
    if (!isCrawlable(groups, "*", path)) {
      items.push({ reason: "blocked_all", subject: path })
    }
    for (const [agent, name] of Object.entries(SEARCH_CRAWLERS)) {
      if (hasOwnGroup(groups, agent) && !isCrawlable(groups, agent, path)) {
        items.push({ reason: "blocked", subject: path, target: name })
      }
    }
  }
  for (const path of facets) {
    // A crawler with a group of its own reads only that group
    const open = [
      "*",
      ...Object.keys(SEARCH_CRAWLERS).filter((agent) => hasOwnGroup(groups, agent)),
    ]
      .filter((agent) => isCrawlable(groups, agent, path))
      .map((agent) =>
        agent === "*" ? null : SEARCH_CRAWLERS[agent as keyof typeof SEARCH_CRAWLERS]
      )
    for (const target of open) {
      items.push({ reason: "facets_open", subject: path, ...(target ? { target } : {}) })
    }
  }
  if (hasHost && !/^\s*sitemap\s*:/im.test(robots)) {
    items.push({ reason: "no_sitemap", subject: "Sitemap:" })
  }
  return finding("S-ROBOTS-01", items)
}

const DAY_MS = 24 * 60 * 60 * 1000
export const SITEMAP_MAX_AGE_MS = 2 * DAY_MS

export interface SitemapFacts {
  hasHost: boolean
  generatedAt: Date | null
  /** Changes wait for the next refresh (it runs every few minutes). */
  isDirty: boolean
  hasFailedRun: boolean
  urls: number
  /** Live pages with an address that belong in it (not noindex, their own canonical). */
  expected: number
  /** Live pages with no address at all: no sitemap, no page. */
  pathless: number
}

/**
 * S-SITEMAP-01: the sitemap came out in the last two days, its last run
 * worked, and it lists the pages that belong in it, with a tenth of slack
 * for changes that do not mark it for a refresh; every live page has an
 * address to list.
 */
export function sitemapFinding(facts: SitemapFacts, now: Date): AuditFinding | null {
  if (!facts.hasHost) {
    return null
  }
  const isStale =
    !facts.generatedAt || now.getTime() - facts.generatedAt.getTime() > SITEMAP_MAX_AGE_MS
  const items: AuditItem[] = []
  if (facts.hasFailedRun) {
    items.push({ reason: "failed", subject: "seo.sitemap" })
  }
  if (isStale) {
    items.push(
      facts.generatedAt
        ? { reason: "stale", subject: facts.generatedAt.toISOString() }
        : { reason: "never", subject: "sitemap.xml" }
    )
  } else if (!facts.isDirty && facts.urls < Math.floor(facts.expected * 0.9)) {
    items.push({ reason: "missing", subject: "urls", count: facts.expected - facts.urls })
  }
  if (facts.pathless > 0) {
    items.push({ reason: "no_path", subject: "url_registry", count: facts.pathless })
  }
  return finding("S-SITEMAP-01", items)
}

/** What a path answers now (resolution's type). */
export type PathAnswer = "entity" | "redirect" | "gone" | "not_found"

export interface RedirectFacts {
  source: string
  /** Null for a 410. */
  target: string | null
  hits: number
  lastHitAt: Date | null
  createdAt: Date
  /** What the source answers (exact rules): a live page there means the rule never runs. */
  sourceAnswer?: PathAnswer | undefined
  /** What the target answers (exact rules with a target). */
  targetAnswer?: PathAnswer | undefined
}

export const IDLE_RULE_MS = 365 * DAY_MS

/**
 * S-REDIR-01, one item per rule, the most pressing reason first: a live
 * page hides the rule; its target is missing or gone; its target
 * redirects again (the rule's target is out of date); no one followed it
 * in a year (rules younger than that have not had the chance).
 */
export function redirectItem(rule: RedirectFacts, now: Date): AuditItem | null {
  const item = (reason: string): AuditItem => ({
    reason,
    subject: rule.source,
    target: rule.target ?? undefined,
  })
  if (rule.sourceAnswer === "entity") {
    return item("shadowed")
  }
  if (rule.targetAnswer === "not_found") {
    return item("dead_target")
  }
  if (rule.targetAnswer === "gone") {
    return item("gone_target")
  }
  if (rule.targetAnswer === "redirect") {
    return item("chain")
  }
  const idleSince = now.getTime() - IDLE_RULE_MS
  const isIdle =
    rule.createdAt.getTime() < idleSince &&
    (rule.lastHitAt === null || rule.lastHitAt.getTime() < idleSince)
  return isIdle ? { ...item("idle"), count: rule.hits } : null
}
