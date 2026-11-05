import { ValidationError } from "../../lib/errors"
import type { AttributeOption } from "./validation"

/**
 * A text attribute that products already have values for, turned into a
 * single choice (adr/0013 Ek 2026-11-05): every stored text names the
 * option it becomes, or `null` to clear it. Nothing is guessed: a stored
 * text the mapping leaves out refuses the whole change, so no product
 * loses its value silently.
 */

/** A stored text and what it becomes: an option's value, or `null` to clear it. */
export interface ConversionPair {
  from: string
  to: string | null
}

export interface StoredText {
  id: string
  value_text: string | null
}

export interface ConversionPlan {
  /** Values that keep their row, their text replaced by the option's value. */
  rewrite: { id: string; from: string; to: string }[]
  /** Values the mapping clears (and rows that held no text at all). */
  clear: { id: string; from: string | null }[]
}

/**
 * Each stored value's fate, after refusing a mapping that names an option
 * the list does not have, maps a text twice, leaves a stored text out, or
 * clears a required attribute's value.
 */
export function planConversion(
  values: readonly StoredText[],
  pairs: readonly ConversionPair[],
  options: readonly AttributeOption[],
  isRequired: boolean
): ConversionPlan {
  const known = new Set(options.map((option) => option.value))
  const target = new Map<string, string | null>()
  for (const pair of pairs) {
    if (target.has(pair.from)) {
      throw new ValidationError("product_attributes.convert_mapping_duplicate", {
        field: "mapping",
      })
    }
    if (pair.to !== null && !known.has(pair.to)) {
      throw new ValidationError("product_attributes.option_unknown", { field: "mapping" })
    }
    target.set(pair.from, pair.to)
  }
  const plan: ConversionPlan = { rewrite: [], clear: [] }
  for (const value of values) {
    const text = value.value_text
    if (text === null || text.trim() === "") {
      plan.clear.push({ id: value.id, from: text })
      continue
    }
    const to = target.get(text)
    if (to === undefined) {
      throw new ValidationError("product_attributes.convert_unmapped", {
        field: "mapping",
        values: { value: text },
      })
    }
    if (to === null) {
      plan.clear.push({ id: value.id, from: text })
    } else {
      plan.rewrite.push({ id: value.id, from: text, to })
    }
  }
  if (isRequired && plan.clear.length > 0) {
    throw new ValidationError("product_attributes.convert_required", { field: "mapping" })
  }
  return plan
}
