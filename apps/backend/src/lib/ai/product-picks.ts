import { z } from "@medusajs/framework/zod"
import { words } from "../seo/advisor/text"
import { suggestionProblems, suggestionText } from "./gate"
import { jsonObjectOf } from "./product-card"
import {
  MAX_NEW_TAGS,
  MAX_SUGGESTED_CATEGORIES,
  MAX_SUGGESTED_TAGS,
  NEW_TAG_MAX_LENGTH,
  NEW_TAG_MAX_WORDS,
  PRODUCT_TAGS_TASK,
} from "./registry/product-page-tasks"
import type { AiTask } from "./registry/tasks"

/**
 * Picks from the shop's own lists (adr/0074 §5 madde 2): a product's tags
 * and categories. The answer is data, never trusted: one JSON object read
 * against a closed schema (`.strict()`: a key it does not name refuses
 * the answer, as does a list longer than the task offers), every code
 * held against the list the prompt named, read on the server. A code not
 * in it refuses the whole answer: nothing it names is offered. A new tag
 * is a short plain label through the shared gate; none is created here.
 */

/** One of the shop's records as the prompt names it: by a short code, never by its id. */
export interface PickChoice {
  code: string
  id: string
  name: string
}

/** What a pick may name: read on the server, never taken from the client or the answer. */
export interface PickAllowed {
  kind: "product_tags" | "product_category"
  choices: PickChoice[]
  /** Names the product already has (tags): a new one that repeats them is dropped. */
  taken: string[]
}

export interface PickedRecord {
  id: string
  name: string
}

/** What the panel offers: existing records by id, new tags apart (tags only). */
export interface ProductPicks {
  picked: PickedRecord[]
  new_tags: string[]
}

export type PicksResult = { picks: ProductPicks } | { problems: string[] }

/** Whether a task picks from the shop's lists (its gate names which list). */
export const isPickTask = (
  task: Pick<AiTask, "gate">
): task is Pick<AiTask, "gate"> & { gate: PickAllowed["kind"] } =>
  task.gate === "product_tags" || task.gate === "product_category"

/** Whether a task's lists are a pick's (a product card's are categories and attributes). */
export const isPickAllowed = (allowed: unknown): allowed is PickAllowed =>
  typeof allowed === "object" &&
  allowed !== null &&
  "choices" in allowed &&
  "kind" in allowed &&
  // A post draft's link list has choices too: only a pick's own kinds are a pick's
  (allowed.kind === "product_tags" || allowed.kind === "product_category")

// Room for a code ("e200"), or an id or a name a model wrote in its place (refused as unknown)
const CODE = z.string().max(64)
const NEW_TAG = z.string().max(NEW_TAG_MAX_LENGTH * 4)

const tagsSchema = z
  .object({
    existing: z.array(CODE).max(MAX_SUGGESTED_TAGS),
    new: z.array(NEW_TAG).max(MAX_NEW_TAGS).optional(),
  })
  .strict()

const categorySchema = z
  .object({ categories: z.array(CODE).max(MAX_SUGGESTED_CATEGORIES) })
  .strict()

const fold = (text: string): string => text.trim().toLocaleLowerCase("tr")

// A new tag is checked as its own short plain text: markup, a link, personal data, shouting
const NEW_TAG_TASK: AiTask = {
  ...PRODUCT_TAGS_TASK,
  gate: "plain_text",
  maxLength: NEW_TAG_MAX_LENGTH,
}
// What a label is made of: letters, digits, spaces, a hyphen, an apostrophe or an ampersand
const TAG_FORM = /^[\p{L}\p{N}][\p{L}\p{N}' &-]*$/u

/** A new tag as offered, or its problems: one line, a few words, plain. */
export function newTagProblems(raw: string): { text: string } | { problems: string[] } {
  const text = suggestionText(raw).replace(/\s+/gu, " ").trim()
  const problems = suggestionProblems(NEW_TAG_TASK, text)
  if (problems.length === 0 && (!TAG_FORM.test(text) || words(text).length > NEW_TAG_MAX_WORDS)) {
    problems.push("noise")
  }
  return problems.length > 0 ? { problems } : { text }
}

/** The records the codes name, in the answer's order, repeats dropped; null when one is not in the list. */
function chosen(codes: readonly string[], allowed: PickAllowed): PickedRecord[] | null {
  const byCode = new Map(allowed.choices.map((each) => [fold(each.code), each]))
  const picked = new Map<string, PickedRecord>()
  for (const code of codes) {
    const found = byCode.get(fold(code))
    if (!found) {
      return null
    }
    picked.set(found.id, { id: found.id, name: found.name })
  }
  return [...picked.values()]
}

/** New tags through their gate; one that names a listed tag is that tag, one the product has is dropped. */
function newTagsOf(
  raw: readonly string[],
  allowed: PickAllowed,
  picked: PickedRecord[]
): { tags: string[] } | { problems: string[] } {
  const byName = new Map(allowed.choices.map((each) => [fold(each.name), each]))
  const taken = new Set(allowed.taken.map(fold))
  const tags = new Map<string, string>()
  for (const each of raw) {
    if (each.trim() === "") {
      continue
    }
    const checked = newTagProblems(each)
    if ("problems" in checked) {
      return { problems: checked.problems.map((problem) => `new.${problem}`) }
    }
    const key = fold(checked.text)
    const listed = byName.get(key)
    if (listed) {
      if (picked.length < MAX_SUGGESTED_TAGS && !picked.some((one) => one.id === listed.id)) {
        picked.push({ id: listed.id, name: listed.name })
      }
    } else if (!taken.has(key)) {
      tags.set(key, checked.text)
    }
  }
  return { tags: [...tags.values()] }
}

/** A service's answer as picks from the shop's lists, or why it was refused. */
export function productPicksOf(raw: string, allowed: PickAllowed): PicksResult {
  const object = jsonObjectOf(raw)
  if (allowed.kind === "product_category") {
    const parsed = categorySchema.safeParse(object)
    if (!parsed.success) {
      return { problems: ["format"] }
    }
    const picked = chosen(parsed.data.categories, allowed)
    if (picked === null) {
      return { problems: ["unknown_code"] }
    }
    return picked.length > 0 ? { picks: { picked, new_tags: [] } } : { problems: ["empty"] }
  }
  const parsed = tagsSchema.safeParse(object)
  if (!parsed.success) {
    return { problems: ["format"] }
  }
  const picked = chosen(parsed.data.existing, allowed)
  if (picked === null) {
    return { problems: ["unknown_code"] }
  }
  const fresh = newTagsOf(parsed.data.new ?? [], allowed, picked)
  if ("problems" in fresh) {
    return fresh
  }
  return picked.length > 0 || fresh.tags.length > 0
    ? { picks: { picked, new_tags: fresh.tags } }
    : { problems: ["empty"] }
}

/** Stored picks back from their suggestion's text; null for any other text. */
export function readProductPicks(text: string | null): ProductPicks | null {
  if (text === null) {
    return null
  }
  try {
    const value: unknown = JSON.parse(text)
    if (
      typeof value !== "object" ||
      value === null ||
      !Array.isArray((value as ProductPicks).picked)
    ) {
      return null
    }
    const picks = value as ProductPicks
    return { picked: picks.picked, new_tags: Array.isArray(picks.new_tags) ? picks.new_tags : [] }
  } catch {
    return null
  }
}
