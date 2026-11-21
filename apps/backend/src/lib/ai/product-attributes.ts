import { attributeValueOf, jsonObjectOf } from "./product-card"
import type { CardAttribute, CardValue } from "./product-card"

/**
 * Values for a product's empty public attributes (adr/0074 §5 madde 3).
 * The answer is data, never trusted: one JSON object of short codes to
 * values, each code held against the list the prompt named (read on the
 * server: only attributes with no value yet, public, of the product's own
 * template) and each value read as its attribute takes it, as a product
 * card's are (lib/ai/product-card.ts): an option of the list, a list of
 * them, a plain number in range, a yes or no, a short plain text through
 * the shared gate.
 *
 * Partial on purpose: a code not in the list or a value that does not fit
 * drops that one value, never the rest, and the dropped ones are counted
 * (`dropped`); an answer with no value left is refused. A model unsure of
 * a value is told to leave it out, so a short answer is the expected one.
 */

/** An empty attribute as the prompt names it: by a short code, never by its key. */
export interface AttributeChoice extends CardAttribute {
  code: string
}

/** What an answer may fill: read on the server, never taken from the client or the answer. */
export interface AttributeAllowed {
  kind: "product_attributes"
  attributes: AttributeChoice[]
}

/** What the panel offers: a value per attribute key, each beside its field. */
export interface AttributeSuggestions {
  values: Record<string, CardValue>
  /** Values of the answer that were not taken (an unknown code, a value that does not fit). */
  dropped: number
}

export type AttributesResult = { suggestions: AttributeSuggestions } | { problems: string[] }

/** The largest number taken, either side of zero: a measure past it is a mistake, not a product. */
export const MAX_ATTRIBUTE_NUMBER = 1_000_000_000

// More codes than any list names (`MAX_CARD_ATTRIBUTES`): the rest is never read
const MAX_ANSWER_KEYS = 60

/** Whether a task's lists are an attributes suggestion's. */
export const isAttributeAllowed = (allowed: unknown): allowed is AttributeAllowed =>
  typeof allowed === "object" &&
  allowed !== null &&
  (allowed as { kind?: unknown }).kind === "product_attributes"

const fold = (text: string): string => text.trim().toLocaleLowerCase("tr")

/** One value as its attribute takes it, a number also in range; null drops it. */
function valueFor(attribute: AttributeChoice, raw: unknown): CardValue | null {
  const value = attributeValueOf(attribute, raw)
  if (typeof value === "number" && Math.abs(value) > MAX_ATTRIBUTE_NUMBER) {
    return null
  }
  return value
}

/** A service's answer as values for the empty attributes, or why it was refused. */
export function productAttributesOf(raw: string, allowed: AttributeAllowed): AttributesResult {
  const object = jsonObjectOf(raw)
  if (object === null) {
    return { problems: ["format"] }
  }
  const byCode = new Map(allowed.attributes.map((each) => [fold(each.code), each]))
  const values: Record<string, CardValue> = Object.create(null) as Record<string, CardValue>
  let dropped = 0
  for (const [code, given] of Object.entries(object).slice(0, MAX_ANSWER_KEYS)) {
    // Left out as unknown: nothing to drop
    if (given === null || given === undefined || given === "") {
      continue
    }
    const attribute = byCode.get(fold(code))
    const value = attribute ? valueFor(attribute, given) : null
    if (!attribute || value === null || Object.hasOwn(values, attribute.key)) {
      dropped++
      continue
    }
    values[attribute.key] = value
  }
  const taken = { ...values }
  if (Object.keys(taken).length === 0) {
    return { problems: [dropped > 0 ? "no_valid_value" : "empty"] }
  }
  return { suggestions: { values: taken, dropped } }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Stored values back from their suggestion's text; null for any other text. */
export function readAttributeSuggestions(text: string | null): AttributeSuggestions | null {
  if (text === null) {
    return null
  }
  try {
    const value: unknown = JSON.parse(text)
    if (!isRecord(value) || !isRecord(value["values"])) {
      return null
    }
    const dropped = value["dropped"]
    return {
      values: value["values"] as Record<string, CardValue>,
      dropped: typeof dropped === "number" ? dropped : 0,
    }
  } catch {
    return null
  }
}
