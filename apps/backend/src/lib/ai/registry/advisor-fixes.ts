import type { PageKind, SeoIssue } from "../../seo/advisor"
import { AI_ENTITY_TYPES } from "../facts"
import type { AiEntityType } from "../facts"
import { findAiTask, isTaskEntity } from "./tasks"

/**
 * The advisor's findings an AI task can fix (adr/0071, docs/22 "Aşama 3"):
 * the panel draws the task's button on the finding, and "Kullan" puts the
 * suggestion in the field's form, never saved on its own (adr/0005).
 *
 * Only the findings the task's gate closes are listed: a suggestion that
 * passes `suggestionProblems` keeps to the very rule that raised them
 * (length and noise for the search texts, the word count for a
 * description). A finding no gate answers (a duplicate, a brand or a focus
 * keyword left out, a heading, a link) has no entry; the rule engine
 * itself is not changed.
 */

/** The form field a suggestion goes to: the SEO card's two, a product's long description. */
export const ADVISOR_AI_FIELDS = ["seo_title", "seo_description", "description"] as const
export type AdvisorAiField = (typeof ADVISOR_AI_FIELDS)[number]

export interface AdvisorAiFix {
  /** The AI task's id (`lib/ai/registry/tasks.ts`). */
  task: string
  field: AdvisorAiField
  /** One of the task's ready-made options, asked first; left out: none. */
  option?: string
}

/** By the rule's id without its kind letter: "P-TITLE-01" and "C-TITLE-01" are one rule. */
export const ADVISOR_AI_FIXES: Readonly<Record<string, AdvisorAiFix>> = {
  "TITLE-01": { task: "seo_title", field: "seo_title" },
  "TITLE-03": { task: "seo_title", field: "seo_title" },
  "META-01": { task: "seo_description", field: "seo_description" },
  // A product's own rule (P- only): the longer of the two lengths reaches the word count
  "CONT-01": { task: "product_description", field: "description", option: "detailed" },
}

/** The rules whose ids carry no kind letter of their own: only a product's has CONT-01. */
const ONLY_FOR: Readonly<Record<string, readonly PageKind[]>> = {
  "CONT-01": ["product"],
}

const ruleOf = (ruleId: string): string => ruleId.slice(ruleId.indexOf("-") + 1)

const isAiEntity = (kind: PageKind): kind is AiEntityType =>
  (AI_ENTITY_TYPES as readonly string[]).includes(kind)

/**
 * The AI fix for a finding on a page of this kind, or null: the rule has
 * no entry, the kind is no record the AI core reads (a brand, a
 * collection, a blog post, a landing page) or the task is not asked for it.
 */
export function advisorAiFix(
  kind: PageKind,
  issue: Pick<SeoIssue, "ruleId">,
  nodeEnv?: string
): AdvisorAiFix | null {
  const rule = ruleOf(issue.ruleId)
  const fix = ADVISOR_AI_FIXES[rule]
  if (!fix || !isAiEntity(kind)) {
    return null
  }
  const only = ONLY_FOR[rule]
  if (only && !only.includes(kind)) {
    return null
  }
  const task = findAiTask(fix.task, nodeEnv)
  if (!task || !isTaskEntity(task, kind)) {
    return null
  }
  return fix.option === undefined || task.options.includes(fix.option)
    ? fix
    : { task: fix.task, field: fix.field }
}

/** The findings with their AI fix beside them, for the panel (the assessment route). */
export const withAdvisorAiFixes = <T extends SeoIssue>(
  kind: PageKind,
  issues: readonly T[]
): (T & { ai?: AdvisorAiFix })[] =>
  issues.map((issue) => {
    const ai = advisorAiFix(kind, issue)
    return ai ? { ...issue, ai } : issue
  })
