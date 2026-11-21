import { SERP_TEXT_LENGTH } from "../../seo/pixel-width"
import type { StaffRole } from "../../staff/permissions"
import type { AiEntityType } from "../facts"
import type { AiCapability } from "./capabilities"
import {
  AI_CANDIDATE_COUNT,
  AI_TEMPERATURE,
  FOCUS_KEYWORD_TASK,
  PRODUCT_TITLE_TASK,
  SEO_FACT_DESCRIPTION_LENGTH,
} from "./catalog-tasks"
import {
  IMAGE_ALT_TEXT_TASK,
  IMAGE_BACKGROUND_TASK,
  IMAGE_SCENE_TASK,
  PRODUCT_FROM_PHOTO_TASK,
} from "./image-tasks"
import {
  BRAND_DESCRIPTION_TASK,
  CATEGORY_DESCRIPTION_TASK,
  COLLECTION_DESCRIPTION_TASK,
} from "./listing-tasks"
import { QUESTION_ANSWER_TASK, REVIEW_REPLY_TASK, REVIEW_SUMMARY_TASK } from "./review-tasks"

/** What a task is asked for: a text record, or a picture of the media library. */
export type AiTaskEntity = AiEntityType | "media"

/**
 * A task: one named operation bound to a capability (adr/0071 §2). There
 * is no free prompt: what is asked comes from the task and, at most, one
 * of its two ready-made options.
 */

export type AiTaskMode = "sync" | "job"

/** What the output is checked as before it is offered (lib/ai/gate.ts). */
export const AI_GATES = [
  "seo_title",
  "seo_description",
  "product_description",
  "image_alt",
  "plain_text",
  // A picture, not a text: read by the upload check (lib/ai/run-image.ts)
  "image",
  // A structured answer: a closed schema and allow-lists (lib/ai/product-card.ts)
  "product_card",
  // Short texts of the product page (registry/catalog-tasks.ts, lib/ai/short-text-gate.ts)
  "focus_keyword",
  "product_title",
  // A category's, a collection's or a brand's description (registry/listing-tasks.ts)
  "listing_description",
] as const
export type AiGate = (typeof AI_GATES)[number]

export const MAX_TASK_OPTIONS = 2

export interface AiTask {
  id: string
  capability: AiCapability
  /** `job` runs as an async job (adr/0014); `sync` answers in the request. */
  mode: AiTaskMode
  /** Ready-made choices next to the button (a tone), two at most. */
  options: readonly string[]
  /** Staff roles that may ask for it; checked in the workflow too. */
  roles: readonly StaffRole[]
  /** Platform credits one run costs (adr/0071 §7); never taken from the client. */
  credits: number
  gate: AiGate
  /** The longest suggestion, in characters; a longer one is refused (`length`). */
  maxLength: number
  /** The kinds of record it is asked for; every text kind when left out. */
  entities?: readonly AiTaskEntity[]
  /** A job task: the most records one request may name (adr/0071 §8). */
  maxBatch?: number
  /** Longest text per data block field for this task, over the shared lengths (lib/ai/facts). */
  factMaxLengths?: Readonly<Record<string, number>>
  /** A tenant flag that must be on to ask for it (`ai.reviews`); checked in the workflow too. */
  flag?: string
  /** What is read for the record instead of its own fields (a product's reviews, not the product). */
  reader?: AiTaskReader
  /**
   * False: the suggestion keeps the instruction only, not the data block
   * (customers' words are not copied into `content_draft`, adr/0071 §10).
   */
  keepData?: boolean
  /** The answer is one JSON object: the service's JSON mode is asked for where it has one. */
  json?: boolean
  /**
   * `scenes`: the options are the shop's scenes, read from its sector packs
   * (lib/ai/scenes.ts), not `options`; only a service with a scene endpoint
   * can run it.
   */
  optionSource?: "scenes"
  /**
   * Candidates asked for in one call, one per line (adr/0074 §4): each is
   * gated on its own (`maxLength` is one candidate's), those that pass
   * are offered in order. Left out: one suggestion.
   */
  candidates?: number
  /** The sampling temperature asked for, where the service's target documents one (`AI_TEMPERATURE`). */
  temperature?: number
}

/** A record read another way than by its type (lib/ai/facts). */
export type AiTaskReader = "product_reviews"

/** Tests only: the core is exercised with it until the real tasks come (Aşama 1). */
export const TEST_TASK: AiTask = {
  id: "test_text",
  capability: "text",
  mode: "sync",
  options: ["plain", "detailed"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "plain_text",
  maxLength: 500,
  entities: ["product", "category", "page"],
}

// The records with a page of their own; an image is none
const PAGE_ENTITIES: readonly AiEntityType[] = [
  "product",
  "category",
  "collection",
  "brand",
  "page",
]

/**
 * A page's search result title and description (Aşama 1, docs/22 PR 1-1),
 * for a product, a listing page (category, collection, brand) or a content page. The gate is the advisor's
 * own rules for the field (P-TITLE-01, P-META-01 and their noise rules),
 * so the longest suggestion is the field's character target.
 */
export const SEO_TITLE_TASK: AiTask = {
  id: "seo_title",
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "seo_title",
  maxLength: SERP_TEXT_LENGTH.title.max,
  entities: PAGE_ENTITIES,
  candidates: AI_CANDIDATE_COUNT,
  temperature: AI_TEMPERATURE.short,
  factMaxLengths: { description: SEO_FACT_DESCRIPTION_LENGTH },
}

export const SEO_DESCRIPTION_TASK: AiTask = {
  id: "seo_description",
  capability: "text",
  mode: "sync",
  options: ["short"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "seo_description",
  maxLength: SERP_TEXT_LENGTH.description.max,
  entities: PAGE_ENTITIES,
  candidates: AI_CANDIDATE_COUNT,
  temperature: AI_TEMPERATURE.short,
  factMaxLengths: { description: SEO_FACT_DESCRIPTION_LENGTH },
}

/** How much of the product's description now the task sends (adr/0005's draft sent as much). */
export const PRODUCT_DESCRIPTION_FACT_LENGTH = 2_000

/** The longest product description suggestion, in characters (the "detailed" option with room). */
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 5_000

/**
 * A product's description (Aşama 2, docs/22 PR 2-1; adr/0005's draft,
 * moved to the core). Plain text paragraphs, never HTML (adr/0071 §9):
 * the description document (adr/0055) takes them as plain paragraphs.
 * The gate is the advisor's word count (`MIN_PRODUCT_WORDS`) and what no
 * suggestion may carry. Two ready-made lengths, nothing typed.
 */
export const PRODUCT_DESCRIPTION_TASK: AiTask = {
  id: "product_description",
  capability: "text",
  mode: "sync",
  options: ["short", "detailed"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "product_description",
  maxLength: PRODUCT_DESCRIPTION_MAX_LENGTH,
  entities: ["product"],
  // The description it improves on goes nearly whole; the SEO tasks read less of it
  factMaxLengths: { description: PRODUCT_DESCRIPTION_FACT_LENGTH },
  temperature: AI_TEMPERATURE.long,
}

export * from "./image-tasks"
export * from "./listing-tasks"
export * from "./review-tasks"

const TASKS: readonly AiTask[] = [
  SEO_TITLE_TASK,
  SEO_DESCRIPTION_TASK,
  PRODUCT_DESCRIPTION_TASK,
  CATEGORY_DESCRIPTION_TASK,
  COLLECTION_DESCRIPTION_TASK,
  BRAND_DESCRIPTION_TASK,
  IMAGE_ALT_TEXT_TASK,
  IMAGE_BACKGROUND_TASK,
  REVIEW_SUMMARY_TASK,
  REVIEW_REPLY_TASK,
  QUESTION_ANSWER_TASK,
  PRODUCT_FROM_PHOTO_TASK,
  IMAGE_SCENE_TASK,
  FOCUS_KEYWORD_TASK,
  PRODUCT_TITLE_TASK,
]

/** The data block's field lengths for a task: the shared ones, and the task's own over them. */
export const factLengthsOf = (
  task: AiTask,
  shared: Readonly<Record<string, number>>
): Readonly<Record<string, number>> => ({ ...shared, ...task.factMaxLengths })

/** Whether a task is asked for this kind of record; left out: a page's kinds only. */
export const isTaskEntity = (task: AiTask, type: AiTaskEntity): boolean =>
  (task.entities ?? PAGE_ENTITIES).includes(type)

/** The tasks of this instance, in registry order. */
export function aiTasks(nodeEnv: string | undefined = process.env["NODE_ENV"]): readonly AiTask[] {
  return nodeEnv === "test" ? [...TASKS, TEST_TASK] : TASKS
}

export function findAiTask(
  id: string,
  nodeEnv: string | undefined = process.env["NODE_ENV"]
): AiTask | null {
  return aiTasks(nodeEnv).find((task) => task.id === id) ?? null
}
