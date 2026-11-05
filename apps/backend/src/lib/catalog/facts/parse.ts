import { isCleanText } from "../../security/text"
import { toSlug } from "../../seo/slug"
import type {
  AttributeInputValue,
  AttributeOption,
  AttributeType,
} from "../../../modules/product-attributes/validation"
import { labelKey, tidy } from "./text"
import { convert } from "./units"
import { BOOLEAN_WORDS } from "./vocabulary"

/**
 * A fact's value read as a field's type takes it (adr/0013 Ek
 * 2026-11-05): a number with its unit in the field's unit, a choice that
 * is one of the field's options, yes or no, or text. What does not read
 * says why; nothing is guessed.
 */

export interface ParseField {
  type: AttributeType
  unit: string | null
  options: AttributeOption[] | null
}

/** Why a value was not taken. */
export type ParseFailure =
  | "number" // no number in it
  | "range" // two numbers as a range: 58–60
  | "unit" // a unit the field's does not convert to
  | "option" // not one of the field's options
  | "boolean" // not a yes or a no
  | "text" // too long, or unreadable characters

export type Parsed =
  { ok: true; value: Exclude<AttributeInputValue, null> } | { ok: false; reason: ParseFailure }

const MAX_TEXT = 500
const MAX_NUMBER = 1e12

export interface NumberToken {
  value: number
  unit: string | null
  /** Where it starts and ends in the text. */
  start: number
  end: number
}

// A number not inside a word (N690 is a name), with the unit written after it
const NUMBER =
  /(?<![\p{L}\d.,])(-?(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?))(?:\s?([\p{L}°%"″µ]+))?/gu

/** "22,5" and "1.250" (Turkish), "3.5" (a point): a dot before exactly three digits groups thousands. */
export function numberOf(text: string): number | null {
  const negative = text.startsWith("-")
  const digits = negative ? text.slice(1) : text
  let normal: string
  if (digits.includes(",")) {
    normal = digits.replace(/\./g, "").replace(",", ".")
  } else if (/^[1-9]\d{0,2}(?:\.\d{3})+$/.test(digits)) {
    normal = digits.replace(/\./g, "")
  } else {
    normal = digits
  }
  const value = Number(normal)
  return Number.isFinite(value) && Math.abs(value) <= MAX_NUMBER
    ? Math.round((negative ? -value : value) * 1e6) / 1e6
    : null
}

/** Every number in a value, each with the unit written right after it. */
export function numberTokens(text: string): NumberToken[] {
  return [...text.matchAll(NUMBER)].flatMap((match) => {
    const value = match[1] ? numberOf(match[1]) : null
    if (value === null) {
      return []
    }
    // A word joining two numbers ("10 ile 12") is no unit
    const unit = match[2] && !RANGE_WORD.test(match[2]) ? match[2] : null
    const length = unit ? match[0].length : (match[1]?.length ?? 0)
    return [{ value, unit, start: match.index, end: match.index + length }]
  })
}

const RANGE_WORD = /^(?:ile|ila|to|ve|veya|and|or)$/i
// Between two numbers of a range: a dash, a tilde, "ile", "to", "–"
const RANGE_GAP = /^\s*(?:[-–—~]|ile|to|ila)\s*$/i

/**
 * The number a value gives a field with `unit`, in that unit. A label's
 * unit (`labelUnit`, "Boy (cm)") stands for a number written without one.
 * Two numbers as a range are none; of several (220 mm / 8,7 inç) the first
 * whose unit the field takes.
 */
export function readNumber(text: string, unit: string | null, labelUnit: string | null): Parsed {
  const tokens = numberTokens(text)
  const [first, second] = tokens
  if (!first) {
    return { ok: false, reason: "number" }
  }
  if (second && RANGE_GAP.test(text.slice(first.end, second.start))) {
    return { ok: false, reason: "range" }
  }
  if (!unit) {
    // A field without a unit takes the number as written
    return { ok: true, value: first.value }
  }
  for (const token of tokens) {
    // A word after the number must be the field's unit or convert to it; none: the label's
    const value = convert(token.value, token.unit ?? labelUnit, unit)
    if (value !== null) {
      return { ok: true, value }
    }
  }
  return { ok: false, reason: "unit" }
}

/** The option a text names: its value, or its name with Turkish letters and case folded. */
export function optionOf(options: readonly AttributeOption[], text: string): string | null {
  const wanted = labelKey(text)
  if (wanted === "" && text.trim() === "") {
    return null
  }
  const found = options.find(
    (option) =>
      option.value === text.trim() ||
      labelKey(option.label) === wanted ||
      (wanted !== "" && toSlug(option.value, 200) === wanted)
  )
  return found?.value ?? null
}

// A trailing remark in brackets ("Siyah (mat)") is tried without it
const withoutBrackets = (text: string): string =>
  tidy(text.replace(/\s*[([][^()[\]]*[)\]]\s*$/, ""))

const SEPARATORS = /\s*(?:[,;|/+&]|\s+ve\s+|\s+and\s+)\s*/i

function readOptions(options: readonly AttributeOption[], text: string): Parsed {
  const whole = optionOf(options, text) ?? optionOf(options, withoutBrackets(text))
  if (whole) {
    return { ok: true, value: [whole] }
  }
  const parts = text.split(SEPARATORS).filter((part) => part.trim() !== "")
  const picked = parts.map(
    (part) => optionOf(options, part) ?? optionOf(options, withoutBrackets(part))
  )
  return picked.length > 0 && picked.every((value) => value !== null)
    ? { ok: true, value: [...new Set(picked)] }
    : { ok: false, reason: "option" }
}

/** A value as a field's type takes it. `labelUnit`: the unit the row's label names. */
export function parseValue(
  field: ParseField,
  raw: string,
  labelUnit: string | null = null
): Parsed {
  const text = tidy(raw)
  switch (field.type) {
    case "number":
      return readNumber(text, field.unit, labelUnit)
    case "boolean": {
      const value = BOOLEAN_WORDS[labelKey(text)]
      return value === undefined ? { ok: false, reason: "boolean" } : { ok: true, value }
    }
    case "select": {
      const options = field.options ?? []
      const value = optionOf(options, text) ?? optionOf(options, withoutBrackets(text))
      return value === null ? { ok: false, reason: "option" } : { ok: true, value }
    }
    case "multi_select":
      return readOptions(field.options ?? [], text)
    case "text":
      return text.length > 0 && text.length <= MAX_TEXT && isCleanText(text)
        ? { ok: true, value: text }
        : { ok: false, reason: "text" }
  }
}

/** Whether two values of one field are the same: a list in any order, a number to six places. */
export function sameValue(a: AttributeInputValue | undefined, b: AttributeInputValue | undefined) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|")
  }
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-6
  }
  return a === b
}
