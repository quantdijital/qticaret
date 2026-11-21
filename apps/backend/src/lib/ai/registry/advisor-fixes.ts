import type { PageKind, SeoIssue } from "../../seo/advisor"
import { AI_ENTITY_TYPES } from "../facts"
import type { AiEntityType } from "../facts"
import { LISTING_DESCRIPTION_TASK_IDS } from "./listing-tasks"
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
 * itself is not changed. P-IMG-02 (images without alt text) has none
 * either: its subject is many images and `image_alt_text` reads one, so
 * its manual fix opens the first image's alt field, where the button is.
 * P-CONT-03 (required attributes left empty) has none: `product_attributes`
 * writes no value it is unsure of, so it cannot promise to close the
 * finding, and its answer is values for a form, not one text for a field;
 * the manual fix opens the attributes card, where its button is.
 */

/** The form field a suggestion goes to: the SEO card's two, a page's long description. */
export const ADVISOR_AI_FIELDS = ["seo_title", "seo_description", "description"] as const
export type AdvisorAiField = (typeof ADVISOR_AI_FIELDS)[number]

export interface AdvisorAiFix {
  /** The AI task's id (`lib/ai/registry/tasks.ts`). */
  task: string
  field: AdvisorAiField
  /** One of the task's ready-made options, asked first; left out: none. */
  option?: string
}

type ByKind = Readonly<Partial<Record<PageKind, AdvisorAiFix>>>

// The longer of the two lengths reaches the word count, a product's (P-) and a listing's (C/B/K-)
const description = (task: string): AdvisorAiFix => ({
  task,
  field: "description",
  option: "detailed",
})

/**
 * By the rule's id without its kind letter: "P-TITLE-01" and "C-TITLE-01"
 * are one rule. An entry is one fix for every kind, or a fix per kind
 * where the rule's subject is the kind's own (CONT-01: a product's
 * description, a listing page's text, adr/0074 §5 madde 1); a kind left
 * out of such an entry has none.
 */
export const ADVISOR_AI_FIXES: Readonly<Record<string, AdvisorAiFix | ByKind>> = {
  "TITLE-01": { task: "seo_title", field: "seo_title" },
  "TITLE-03": { task: "seo_title", field: "seo_title" },
  "META-01": { task: "seo_description", field: "seo_description" },
  "CONT-01": {
    product: description("product_description"),
    category: description(LISTING_DESCRIPTION_TASK_IDS.category),
    collection: description(LISTING_DESCRIPTION_TASK_IDS.collection),
    brand: description(LISTING_DESCRIPTION_TASK_IDS.brand),
  },
}

const ruleOf = (ruleId: string): string => ruleId.slice(ruleId.indexOf("-") + 1)

const isFix = (entry: AdvisorAiFix | ByKind): entry is AdvisorAiFix =>
  typeof (entry as { task?: unknown }).task === "string"

/** Every fix an entry names, for every kind (tests and the docs list them). */
export const fixesOf = (entry: AdvisorAiFix | ByKind): AdvisorAiFix[] =>
  isFix(entry) ? [entry] : Object.values(entry)

const isAiEntity = (kind: PageKind): kind is Extract<PageKind, AiEntityType> =>
  (AI_ENTITY_TYPES as readonly string[]).includes(kind)

/**
 * The AI fix for a finding on a page of this kind, or null: the rule has
 * no entry for the kind, the kind is no record the AI core reads (a blog
 * post, a landing page) or the task is not asked for it.
 */
export function advisorAiFix(
  kind: PageKind,
  issue: Pick<SeoIssue, "ruleId">,
  nodeEnv?: string
): AdvisorAiFix | null {
  const entry = ADVISOR_AI_FIXES[ruleOf(issue.ruleId)]
  if (!entry || !isAiEntity(kind)) {
    return null
  }
  const fix = isFix(entry) ? entry : entry[kind]
  if (!fix) {
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
