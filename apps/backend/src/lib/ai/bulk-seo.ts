import type { PageKind, SeoIssue } from "../seo/advisor"
import type { AiEntityType } from "./facts"
import { advisorAiFix } from "./registry/advisor-fixes"

/**
 * Filling the search texts in bulk (adr/0074 §5 madde 7, G7): the pages
 * whose advisor findings an AI search text closes (TITLE-01, TITLE-03,
 * META-01 by `advisorAiFix`, so the bulk job and a finding's own button
 * never disagree), each asked through the same task, reader, gate and
 * guidance as a single ask. Pure: the job and the start route read the
 * rows, this decides which pages and tasks they make.
 */

/** Pages one bulk job asks for at most. */
export const SEO_FILL_MAX = 50

/** The fields the job fills: the SEO card's two. */
export const SEO_FILL_FIELDS = ["seo_title", "seo_description"] as const
export type SeoFillField = (typeof SEO_FILL_FIELDS)[number]

/** What the person asks to fill; `both` is the button's own, the rest are the advanced choice. */
export const SEO_FILL_SCOPES = ["both", "title", "description"] as const
export type SeoFillScope = (typeof SEO_FILL_SCOPES)[number]

export const fieldsOfScope = (scope: SeoFillScope): readonly SeoFillField[] =>
  scope === "title"
    ? ["seo_title"]
    : scope === "description"
      ? ["seo_description"]
      : SEO_FILL_FIELDS

// A rule of each field's fix: the kinds where it has one are the kinds worth reading
const PROBE_RULES = ["X-TITLE-01", "X-META-01"]

/** The kinds of page a search text is asked for (`advisorAiFix`): a blog post too once its tasks read it. */
export const seoFillKinds = (kinds: readonly PageKind[], nodeEnv?: string): PageKind[] =>
  kinds.filter((kind) =>
    PROBE_RULES.some((ruleId) => advisorAiFix(kind, { ruleId }, nodeEnv) !== null)
  )

/** A stored assessment as far as the job reads it. */
export interface AssessedPage {
  entity_type: string
  entity_id: string
  issues: unknown
}

/** One page and the tasks asked for it, the title's first. */
export interface SeoFillTarget {
  entity_type: AiEntityType
  entity_id: string
  tasks: string[]
}

const ruleIdsOf = (issues: unknown): string[] =>
  Array.isArray(issues)
    ? issues.flatMap((issue: Partial<SeoIssue> | null) =>
        typeof issue?.ruleId === "string" ? [issue.ruleId] : []
      )
    : []

/**
 * The tasks a page's findings ask for among these fields, in the fields'
 * order; empty when none: no such finding, a kind the AI core does not
 * read, or the task not asked for the kind (`advisorAiFix`).
 */
export function seoFillTasks(
  page: AssessedPage,
  fields: readonly SeoFillField[],
  nodeEnv?: string
): string[] {
  const byField = new Map<SeoFillField, string>()
  for (const ruleId of ruleIdsOf(page.issues)) {
    const fix = advisorAiFix(page.entity_type as PageKind, { ruleId }, nodeEnv)
    const field = SEO_FILL_FIELDS.find((each) => each === fix?.field)
    if (fix && field && fields.includes(field)) {
      byField.set(field, fix.task)
    }
  }
  return SEO_FILL_FIELDS.flatMap((field) => {
    const task = byField.get(field)
    return task ? [task] : []
  })
}

/**
 * Every page worth asking for, in the order read (the lowest score first),
 * with the tasks not already waiting for a decision. `waiting` holds
 * `type:id:task` for the suggestions open now: asking again would only
 * spend the quota on a second one. Not cut to `SEO_FILL_MAX`: the panel
 * shows how many there are, the job takes the first of them.
 */
export function seoFillTargets(
  pages: readonly AssessedPage[],
  fields: readonly SeoFillField[],
  waiting: ReadonlySet<string> = new Set(),
  nodeEnv?: string
): SeoFillTarget[] {
  const seen = new Set<string>()
  const targets: SeoFillTarget[] = []
  for (const page of pages) {
    const key = `${page.entity_type}:${page.entity_id}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    const tasks = seoFillTasks(page, fields, nodeEnv).filter(
      (task) => !waiting.has(`${key}:${task}`)
    )
    if (tasks.length > 0) {
      targets.push({
        entity_type: page.entity_type as AiEntityType,
        entity_id: page.entity_id,
        tasks,
      })
    }
  }
  return targets
}

/** The asks a set of pages makes: one call, one credit each (adr/0074 §4). */
export const asksOf = (targets: readonly SeoFillTarget[]): number =>
  targets.reduce((total, target) => total + target.tasks.length, 0)

/** What the quota still allows today: the month's AI operations and the day's text ceiling, the lower. */
export function quotaLeft(input: {
  monthly: { used: number; limit: number | null }
  daily: { used: number; limit: number }
}): number {
  const day = Math.max(0, input.daily.limit - input.daily.used)
  return input.monthly.limit === null
    ? day
    : Math.min(day, Math.max(0, input.monthly.limit - input.monthly.used))
}
