import { z } from "@medusajs/framework/zod"
import { MAX_SUGGESTION_CHARS, suggestionProblems, suggestionText } from "./gate"
import { PRODUCT_FROM_PHOTO_TASK } from "./registry/tasks"
import type { AiTask } from "./registry/tasks"

/**
 * A product card read from a service's answer (Aşama 6, docs/22; adr/0071
 * §9). The answer is data, never trusted: one JSON object is taken out of
 * it and read against a closed schema, so a price, stock, status, code or
 * any other key the model writes is never read at all. Its texts pass the
 * shared gate; the category must be one of the shop's shown categories
 * named in the prompt, and an attribute one of the chosen template's, its
 * value one of its options where it has them. What does not fit is
 * dropped; a card without a clean name is refused.
 */

export type CardAttributeType = "text" | "number" | "boolean" | "select" | "multi_select"

export interface CardOption {
  value: string
  label: string
}

/** A shown category as the prompt names it: by a short code, never by its id. */
export interface CardCategory {
  code: string
  id: string
  name: string
}

/** A product attribute of the chosen template the card may fill. */
export interface CardAttribute {
  key: string
  label: string
  type: CardAttributeType
  unit: string | null
  options: CardOption[] | null
}

/** What the card may name: read on the server, never taken from the client or the answer. */
export interface CardAllowed {
  categories: CardCategory[]
  attributes: CardAttribute[]
}

export type CardValue = string | number | boolean | string[]

/** The card the form is filled with; nothing else is ever in it. */
export interface ProductCard {
  title: string
  short_description: string | null
  category_id: string | null
  attributes: Record<string, CardValue>
}

export type CardResult = { card: ProductCard } | { problems: string[] }

export const CARD_TITLE_MAX = 120
export const CARD_SUMMARY_MAX = 600
export const CARD_TEXT_VALUE_MAX = 120
const MAX_ATTRIBUTE_KEYS = 60
const MAX_LIST_VALUES = 30

// Each text checked as its own plain text: markup, a link, personal data, shouting
const textTask = (maxLength: number): AiTask => ({
  ...PRODUCT_FROM_PHOTO_TASK,
  gate: "plain_text",
  maxLength,
})
const TITLE_TASK = textTask(CARD_TITLE_MAX)
const SUMMARY_TASK = textTask(CARD_SUMMARY_MAX)
const VALUE_TASK = textTask(CARD_TEXT_VALUE_MAX)

/**
 * The answer's schema. Not `.strict()` on purpose: every key it does not
 * name (a price the model was talked into) is stripped, never read, never
 * passed on; what it names must have its type, or the card is refused.
 */
const answerSchema = z.object({
  title: z.string().max(CARD_TITLE_MAX * 4),
  short_description: z
    .string()
    .max(CARD_SUMMARY_MAX * 4)
    .nullish(),
  category: z.string().max(200).nullish(),
  attributes: z.record(z.string().max(64), z.unknown()).nullish(),
})

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * The one JSON object of an answer: as it is in JSON mode, or between the
 * first `{` and the last `}` of a service without one (a fence or a
 * sentence around it). Null when there is none.
 */
export function jsonObjectOf(raw: string): Record<string, unknown> | null {
  const text = raw.slice(0, MAX_SUGGESTION_CHARS)
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) {
    return null
  }
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1))
    return isObject(value) ? value : null
  } catch {
    return null
  }
}

const fold = (text: string): string => text.trim().toLocaleLowerCase("tr")

/** A text through the gate: cleaned, or null with its problems. */
function gated(task: AiTask, raw: string): { text: string } | { problems: string[] } {
  const text = suggestionText(raw)
  const problems = suggestionProblems(task, text)
  return problems.length > 0 ? { problems } : { text }
}

/** The category the answer names, by its code or its exact name; null when none of the shop's. */
function categoryOf(named: string | null | undefined, allowed: CardAllowed): string | null {
  if (!named) {
    return null
  }
  const wanted = fold(named)
  const found = allowed.categories.find(
    (each) => fold(each.code) === wanted || fold(each.name) === wanted
  )
  return found?.id ?? null
}

// An option by its value or its label, as the model may have read either
const optionOf = (attribute: CardAttribute, raw: unknown): string | null => {
  if (typeof raw !== "string") {
    return null
  }
  const wanted = fold(raw)
  const found = (attribute.options ?? []).find(
    (each) => fold(each.value) === wanted || fold(each.label) === wanted
  )
  return found?.value ?? null
}

const NUMBER = /^-?\d+(?:[.,]\d+)?$/
const YES = new Set(["true", "evet", "var", "yes"])
const NO = new Set(["false", "hayır", "hayir", "yok", "no"])

/** One attribute's value as its definition takes it; null drops it. */
function valueOf(attribute: CardAttribute, raw: unknown): CardValue | null {
  switch (attribute.type) {
    case "text": {
      if (typeof raw !== "string") {
        return null
      }
      const result = gated(VALUE_TASK, raw)
      return "text" in result && !result.text.includes("\n") ? result.text : null
    }
    case "number": {
      if (typeof raw === "number") {
        return Number.isFinite(raw) ? raw : null
      }
      const text = typeof raw === "string" ? raw.trim() : ""
      return NUMBER.test(text) ? Number(text.replace(",", ".")) : null
    }
    case "boolean": {
      if (typeof raw === "boolean") {
        return raw
      }
      const text = typeof raw === "string" ? fold(raw) : ""
      return YES.has(text) ? true : NO.has(text) ? false : null
    }
    case "select":
      return optionOf(attribute, raw)
    case "multi_select": {
      const list: unknown[] = Array.isArray(raw) ? raw.slice(0, MAX_LIST_VALUES) : [raw]
      const values = [
        ...new Set(list.map((each) => optionOf(attribute, each)).filter((each) => each !== null)),
      ]
      return values.length > 0 ? values : null
    }
  }
}

/** The attributes the template defines, each value as its definition takes it; the rest dropped. */
function attributesOf(
  raw: Record<string, unknown> | null | undefined,
  allowed: CardAllowed
): Record<string, CardValue> {
  const byKey = new Map(allowed.attributes.map((each) => [each.key, each]))
  const values: Record<string, CardValue> = Object.create(null) as Record<string, CardValue>
  for (const [key, value] of Object.entries(raw ?? {}).slice(0, MAX_ATTRIBUTE_KEYS)) {
    const attribute = byKey.get(key)
    const read = attribute ? valueOf(attribute, value) : null
    if (attribute && read !== null) {
      values[attribute.key] = read
    }
  }
  return { ...values }
}

/** A service's answer as a card, or why it was refused (`format`, or a text's gate problems). */
export function productCardOf(raw: string, allowed: CardAllowed): CardResult {
  const parsed = answerSchema.safeParse(jsonObjectOf(raw))
  if (!parsed.success) {
    return { problems: ["format"] }
  }
  const answer = parsed.data
  const title = gated(TITLE_TASK, answer.title)
  if ("problems" in title) {
    return { problems: title.problems.map((each) => `title.${each}`) }
  }
  if (title.text.includes("\n")) {
    return { problems: ["title.lines"] }
  }
  let summary: string | null = null
  if (answer.short_description && answer.short_description.trim() !== "") {
    const checked = gated(SUMMARY_TASK, answer.short_description)
    if ("problems" in checked) {
      return { problems: checked.problems.map((each) => `short_description.${each}`) }
    }
    summary = checked.text
  }
  return {
    card: {
      title: title.text,
      short_description: summary,
      category_id: categoryOf(answer.category, allowed),
      attributes: attributesOf(answer.attributes, allowed),
    },
  }
}

/** A stored card back from its suggestion's text; null for any other text. */
export function readProductCard(text: string | null): ProductCard | null {
  if (text === null) {
    return null
  }
  try {
    const value: unknown = JSON.parse(text)
    return isObject(value) && typeof value["title"] === "string"
      ? (value as unknown as ProductCard)
      : null
  } catch {
    return null
  }
}
