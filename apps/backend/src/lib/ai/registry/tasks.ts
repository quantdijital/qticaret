import { AI_REVIEWS } from "../../../modules/platform-settings/features"
import { SERP_TEXT_LENGTH } from "../../seo/pixel-width"
import type { StaffRole } from "../../staff/permissions"
import type { AiEntityType } from "../facts"
import type { AiCapability } from "./capabilities"
import { FOCUS_KEYWORD_TASK, PRODUCT_TITLE_TASK } from "./catalog-tasks"

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
const PAGE_ENTITIES: readonly AiEntityType[] = ["product", "category", "page"]

/**
 * A page's search result title and description (Aşama 1, docs/22 PR 1-1),
 * for a product, a category or a content page. The gate is the advisor's
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
  // The description it improves on goes nearly whole; the SEO tasks keep the shared 300
  factMaxLengths: { description: PRODUCT_DESCRIPTION_FACT_LENGTH },
}

/**
 * The longest alt text suggested: what a screen reader reads in one go
 * (docs/13 §8). The field itself takes up to `ALT_MAX` (250); the
 * advisor's rule (P-IMG-02) asks only that there is one.
 */
export const IMAGE_ALT_MAX_LENGTH = 125

/** Images one bulk alt text job asks for at most (`ai.alt_text`, docs/22 "Aşama 5"). */
export const IMAGE_ALT_BULK_MAX = 50

/**
 * An image's alt text (Aşama 5, docs/22): the service sees the picture
 * and, when a product shows it, the product's name and category. One line
 * of plain text; the gate refuses filler ("görseli", "fotoğrafı"), a
 * link, personal data and markup. Asked for one image here, for many by
 * the bulk job; either way it is a suggestion, saved only by the form.
 */
export const IMAGE_ALT_TEXT_TASK: AiTask = {
  id: "image_alt_text",
  capability: "vision",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "image_alt",
  maxLength: IMAGE_ALT_MAX_LENGTH,
  entities: ["media"],
}

/** The most pictures one background request may name (adr/0071 §8: each its own call and claim). */
export const IMAGE_BACKGROUND_MAX_BATCH = 20

/**
 * A picture's background taken away or made white (Aşama 4, docs/22 PR 4-1):
 * a new picture beside the original, marked as AI edited; the original's
 * bytes are never changed. A job (`ai.image_edit`), one to twenty pictures.
 */
export const IMAGE_BACKGROUND_TASK: AiTask = {
  id: "image_background",
  capability: "image_edit",
  mode: "job",
  options: ["transparent", "white"],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "image",
  maxLength: 0,
  entities: ["media"],
  maxBatch: IMAGE_BACKGROUND_MAX_BATCH,
}

/** The most pictures one scene request may name: a dearer call, asked for one at a time. */
export const IMAGE_SCENE_MAX_BATCH = 1

/**
 * A product photo set in a ready-made scene (Aşama 7, docs/22): a new
 * picture beside the original, marked as AI made (`edited` or `generated`,
 * as the service's scene endpoint is recorded); the original's bytes are
 * never changed. The scenes, two at most, come from the shop's sector
 * pack as data; nothing typed by anyone reaches the service. A job
 * (`ai.image_edit`), like the background.
 */
export const IMAGE_SCENE_TASK: AiTask = {
  id: "image_scene",
  capability: "image_edit",
  mode: "job",
  options: [],
  optionSource: "scenes",
  roles: ["owner", "admin"],
  credits: 1,
  gate: "image",
  maxLength: 0,
  entities: ["media"],
  maxBatch: IMAGE_SCENE_MAX_BATCH,
}

// --- Aşama 9: reviews and questions (docs/22) ---

/** The approved reviews one summary reads at most, newest first (the data block's list limit). */
export const REVIEW_SUMMARY_MAX_REVIEWS = 30

/** Fewer approved reviews than this leave nothing to sum up (`ai.not_enough_reviews`). */
export const REVIEW_SUMMARY_MIN_REVIEWS = 3

/** How much of one review a summary reads (title and text together). */
export const REVIEW_SUMMARY_REVIEW_LENGTH = 400

/** The longest review summary suggested: a few sentences of pros and cons. */
export const REVIEW_SUMMARY_MAX_LENGTH = 1_200

/** The longest reply or answer suggested: the reply's own limit (`REVIEW_REPLY_MAX`, `qaText`). */
export const REVIEW_REPLY_MAX_LENGTH = 1_000

// Customers' own words: the shop's flag, a reply's roles (moderation is `operations`' too)
const REVIEW_TASK_BASE = {
  capability: "text",
  mode: "sync",
  options: [],
  roles: ["owner", "admin", "operations"],
  credits: 1,
  gate: "plain_text",
  flag: AI_REVIEWS,
  keepData: false,
} as const satisfies Partial<AiTask>

/**
 * A product's approved reviews summed up (Aşama 9, adr/0071 §6, §10): what
 * buyers praise and what they miss, shown on the review screen as a
 * suggestion and never put on the storefront here. Only the reviews'
 * ratings and words go, each author's name masked in them; no name,
 * contact, order or customer field is read.
 */
export const REVIEW_SUMMARY_TASK: AiTask = {
  ...REVIEW_TASK_BASE,
  id: "review_summary",
  maxLength: REVIEW_SUMMARY_MAX_LENGTH,
  entities: ["product"],
  reader: "product_reviews",
  factMaxLengths: { reviews: REVIEW_SUMMARY_REVIEW_LENGTH },
}

/**
 * A reply to one approved review, drafted (Aşama 9): it fills the reply
 * form and is sent only when a person sends it. The review's rating,
 * title and words go, its author's name masked; the product's name too.
 */
export const REVIEW_REPLY_TASK: AiTask = {
  ...REVIEW_TASK_BASE,
  id: "review_reply",
  maxLength: REVIEW_REPLY_MAX_LENGTH,
  entities: ["review"],
  factMaxLengths: { review: REVIEW_REPLY_MAX_LENGTH },
}

/**
 * The shop's answer to a product question, drafted (Aşama 9) from the
 * product's published fields: it fills the answer box and is sent only by
 * a person. The question's words go, its author's name masked.
 */
export const QUESTION_ANSWER_TASK: AiTask = {
  ...REVIEW_TASK_BASE,
  id: "question_answer",
  maxLength: REVIEW_REPLY_MAX_LENGTH,
  entities: ["question"],
  factMaxLengths: { question: REVIEW_REPLY_MAX_LENGTH, description: 1_000 },
}

/** The longest answer read for a product card, in characters: its JSON, all fields together. */
export const PRODUCT_CARD_MAX_LENGTH = 4_000

/**
 * A new product's card from one photo (Aşama 6, docs/22): its name, a
 * short description, one of the shop's shown categories and values for
 * the chosen template's attributes, as one JSON object read against a
 * closed schema and the shop's own lists (lib/ai/product-card.ts). No
 * price, stock, status or code is asked for or taken. Nothing is saved:
 * the result fills the new product form.
 */
export const PRODUCT_FROM_PHOTO_TASK: AiTask = {
  id: "product_from_photo",
  capability: "vision",
  mode: "sync",
  options: [],
  roles: ["owner", "admin"],
  credits: 1,
  gate: "product_card",
  maxLength: PRODUCT_CARD_MAX_LENGTH,
  entities: ["media"],
  json: true,
}

const TASKS: readonly AiTask[] = [
  SEO_TITLE_TASK,
  SEO_DESCRIPTION_TASK,
  PRODUCT_DESCRIPTION_TASK,
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
