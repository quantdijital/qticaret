import { MIN_ARTICLE_WORDS } from "../../seo/advisor/rules-content"
import { AI_TEMPERATURE } from "./catalog-tasks"
import type { AiTask } from "./tasks"

/**
 * A blog post's draft (adr/0074 §5 madde 5): headed sections of plain
 * paragraphs from the post's own title, focus keyword and summary, read on
 * the server (adr/0071 §2: nothing typed at the ask). Internal links are a
 * list apart, each a code from the shop's shown categories and published
 * products (`link_choices`); the body itself carries none, a person adds
 * them. One JSON object, every text through the shared gate on its own
 * (lib/ai/post-draft.ts). A reader reads the words: the shop's guidance
 * and the owner's craft apply (`prose`). Nothing is written here: "Kullan"
 * puts the draft in the post's editor as an unsaved change.
 */

/** The words a draft is asked for, and what the gate holds it to (a little room each way). */
export const POST_WORDS = {
  min: 600,
  short: 800,
  usual: 1_000,
  detailed: 1_200,
} as const

/**
 * The gate's word range: under the ask's floor by a quarter (a model's
 * count is rough), never under the advisor's article floor (A-LEN-01), and
 * over the longest ask by a third.
 */
export const POST_GATE_WORDS = {
  min: Math.max(MIN_ARTICLE_WORDS, Math.round(POST_WORDS.min * 0.75)),
  max: Math.round(POST_WORDS.detailed * 1.34),
} as const

/** Sections one draft holds: at least, at most (the opening without a heading is one). */
export const POST_SECTIONS = { min: 3, max: 12 } as const

/** Paragraphs one section holds at most. */
export const POST_SECTION_PARAGRAPHS = 8

/** The longest heading and paragraph of a draft, in characters. */
export const POST_HEADING_MAX_LENGTH = 90
export const POST_PARAGRAPH_MAX_LENGTH = 1_200

/** Internal link candidates the data block lists at most, and how many of them may be categories. */
export const POST_LINK_CHOICES = 30
export const POST_LINK_CATEGORIES = 10

/** Links one draft suggests at most, and the longest reason given for one, in characters. */
export const POST_MAX_LINKS = 8
export const POST_LINK_WHY_MAX_LENGTH = 160

/** The longest draft read, in characters: its JSON, every section and link together. */
export const POST_DRAFT_MAX_LENGTH = 16_000

/**
 * The output budget asked for, in tokens: a detailed draft as JSON with
 * room (Turkish runs near two tokens a word), and no more than a common
 * model's output cap; the length formula of the other tasks would ask
 * several times this.
 */
export const POST_DRAFT_MAX_TOKENS = 8_000

/** How much of the post's summary the draft reads. */
export const POST_SUMMARY_FACT_LENGTH = 600

export const POST_DRAFT_TASK: AiTask = {
  id: "post_draft",
  capability: "text",
  mode: "sync",
  options: ["short", "detailed"],
  // Those who may write a post: content routes are not among operations' writes
  roles: ["owner", "admin"],
  credits: 1,
  gate: "post_draft",
  maxLength: POST_DRAFT_MAX_LENGTH,
  maxTokens: POST_DRAFT_MAX_TOKENS,
  entities: ["post"],
  factMaxLengths: { summary: POST_SUMMARY_FACT_LENGTH },
  json: true,
  prose: true,
  temperature: AI_TEMPERATURE.long,
}
