import { AI_REVIEWS } from "../../../modules/platform-settings/features"
import type { AiTask } from "./tasks"
import { AI_TEMPERATURE } from "./catalog-tasks"

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
  temperature: AI_TEMPERATURE.factual,
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
  temperature: AI_TEMPERATURE.long,
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
  temperature: AI_TEMPERATURE.factual,
}
