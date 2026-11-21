import { z } from "@medusajs/framework/zod"
import { suggestionProblems, suggestionText } from "./gate"
import { jsonObjectOf } from "./product-card"
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_MAX_ITEMS,
  FAQ_MIN_VALID_ITEMS,
  FAQ_QUESTION_MAX_LENGTH,
  PRODUCT_FAQ_TASK,
} from "./registry/product-page-tasks"
import type { AiTask } from "./registry/tasks"

/**
 * A product's FAQ draft (adr/0074 §5 madde 4). The answer is data, never
 * trusted: one JSON object `{"items": [{"q": …, "a": …}]}` (`.strict()` at
 * the top: another key refuses it). Each item is read on its own: its
 * question one line ending in "?", at most `FAQ_QUESTION_MAX_LENGTH`; its
 * answer one paragraph, at most `FAQ_ANSWER_MAX_LENGTH`; both through the
 * shared gate (markup, a link, personal data, shouting, a masked name left
 * in) and with no price written (a price is never in the data and changes).
 * One that fails, repeats another or a question the product already has
 * drops (`dropped`); fewer than `FAQ_MIN_VALID_ITEMS` left refuses the
 * answer. The same check holds the items a person edited before they are
 * stored (`faqItemOf`).
 */

export interface FaqItem {
  question: string
  answer: string
}

/** What a FAQ answer is held against: the product's published questions, read on the server. */
export interface FaqAllowed {
  kind: "product_faq"
  /** Its published questions, folded: one asked again drops. */
  published: string[]
}

/** What the panel offers: the items in order, and how many of the answer's were not taken. */
export interface FaqSuggestions {
  items: FaqItem[]
  dropped: number
}

export type FaqResult = { suggestions: FaqSuggestions } | { problems: string[] }

/** Whether a task's lists are a FAQ draft's. */
export const isFaqAllowed = (allowed: unknown): allowed is FaqAllowed =>
  typeof allowed === "object" &&
  allowed !== null &&
  (allowed as { kind?: unknown }).kind === "product_faq"

// More items than any answer should hold are not read at all
const MAX_ANSWER_ITEMS = FAQ_MAX_ITEMS * 2

const answerSchema = z.object({ items: z.array(z.unknown()).max(MAX_ANSWER_ITEMS) }).strict()

const itemSchema = z
  .object({
    q: z.string().max(FAQ_QUESTION_MAX_LENGTH * 4),
    a: z.string().max(FAQ_ANSWER_MAX_LENGTH * 4),
  })
  .strict()

// Each text as its own short plain text: the shared gate, the item's own length
const QUESTION_TASK: AiTask = {
  ...PRODUCT_FAQ_TASK,
  gate: "plain_text",
  maxLength: FAQ_QUESTION_MAX_LENGTH,
}
const ANSWER_TASK: AiTask = {
  ...PRODUCT_FAQ_TASK,
  gate: "plain_text",
  maxLength: FAQ_ANSWER_MAX_LENGTH,
}

// A price in Turkish lira: never in the data, and stale the day it changes
const PRICE = /₺|\d\s*(?:TL|TRY)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(?:TL|TRY)\s*\d/u

/**
 * The data block's list of published questions: what the instruction names.
 * Here, not with the facts, so an instruction naming it does not load the
 * facts' modules (platform settings) and close an import cycle.
 */
export const PUBLISHED_QUESTIONS_FIELD = "published_questions"

// Markup in what was written, before it is cleaned: a tag is refused, never silently dropped
const MARKUP = /<\/?[a-z!?]/i

/** A text as stored: plain (`suggestionText`), then one line. */
const oneLine = (raw: string): string => suggestionText(raw).replace(/\s+/gu, " ").trim()

/** A question folded for comparison: lower case, marks and spaces taken out. */
export const foldQuestion = (text: string): string =>
  text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

function textProblems(task: AiTask, raw: string, text: string): string[] {
  const problems = suggestionProblems(task, text)
  if (MARKUP.test(raw) && !problems.includes("markup")) {
    problems.push("markup")
  }
  if (problems.length === 0 && PRICE.test(text)) {
    problems.push("price")
  }
  return problems
}

/**
 * One item as stored, or its problems (`q.<problem>`, `a.<problem>`): the
 * check an answer's item and a person's edited one both go through.
 */
export function faqItemOf(raw: {
  q: string
  a: string
}): { item: FaqItem } | { problems: string[] } {
  const question = oneLine(raw.q)
  const answer = oneLine(raw.a)
  const problems = [
    ...textProblems(QUESTION_TASK, raw.q, question).map((each) => `q.${each}`),
    ...(question !== "" && !question.endsWith("?") ? ["q.not_a_question"] : []),
    ...textProblems(ANSWER_TASK, raw.a, answer).map((each) => `a.${each}`),
  ]
  return problems.length > 0 ? { problems } : { item: { question, answer } }
}

/** A service's answer as FAQ items, or why it was refused. */
export function productFaqOf(raw: string, allowed: FaqAllowed): FaqResult {
  const parsed = answerSchema.safeParse(jsonObjectOf(raw))
  if (!parsed.success) {
    return { problems: ["format"] }
  }
  const seen = new Set(allowed.published)
  const items: FaqItem[] = []
  let dropped = 0
  for (const each of parsed.data.items) {
    const shaped = itemSchema.safeParse(each)
    const read = shaped.success ? faqItemOf(shaped.data) : null
    const key = read && "item" in read ? foldQuestion(read.item.question) : null
    if (
      !read ||
      !("item" in read) ||
      key === null ||
      seen.has(key) ||
      items.length >= FAQ_MAX_ITEMS
    ) {
      dropped++
      continue
    }
    seen.add(key)
    items.push(read.item)
  }
  if (items.length < FAQ_MIN_VALID_ITEMS) {
    return { problems: [parsed.data.items.length === 0 ? "empty" : "too_few_valid_items"] }
  }
  return { suggestions: { items, dropped } }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Stored items back from their suggestion's text; null for any other text. */
export function readFaqSuggestions(text: string | null): FaqSuggestions | null {
  if (text === null) {
    return null
  }
  try {
    const value: unknown = JSON.parse(text)
    if (!isRecord(value) || !Array.isArray(value["items"])) {
      return null
    }
    const items = value["items"].flatMap((each: unknown): FaqItem[] =>
      isRecord(each) && typeof each["question"] === "string" && typeof each["answer"] === "string"
        ? [{ question: each["question"], answer: each["answer"] }]
        : []
    )
    const dropped = value["dropped"]
    return { items, dropped: typeof dropped === "number" ? dropped : 0 }
  } catch {
    return null
  }
}
