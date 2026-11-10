import { parseCountInput, parseDecimalInput } from "./money-input"

/** How a number field reads its text and moves by a step. */
export interface StepRule {
  /** The browser's number input: its value a plain number ("12.5"), not typed the Turkish way */
  plain: boolean
  /** Decimals the field takes ("12,50": 2); 0 for whole numbers */
  decimals: number
  min?: number | undefined
  max?: number | undefined
  step: number
}

const MINUS = /^[-−]/

/** The field's text as a number; null while it is empty or not a number. */
export function readNumber(
  text: string,
  rule: Pick<StepRule, "plain" | "decimals">
): number | null {
  const value = text.trim()
  if (value === "") {
    return null
  }
  if (rule.plain) {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }
  // Typed the Turkish way (lib/money-input), a leading minus allowed
  const body = value.replace(MINUS, "")
  const number = rule.decimals > 0 ? parseDecimalInput(body, rule.decimals) : parseCountInput(body)
  if (number === null) {
    return null
  }
  return MINUS.test(value) ? -number : number
}

const digitsOf = (number: number): number => {
  const text = String(number)
  const at = text.indexOf(".")
  return at < 0 ? 0 : text.length - at - 1
}

/**
 * The text one step up or down, held between min and max. An empty field
 * starts from zero (or its minimum). Turkish text keeps what it showed:
 * "12,50" becomes "13,50" and "1.250" becomes "1.251".
 */
export function stepText(text: string, direction: 1 | -1, rule: StepRule): string {
  const current = readNumber(text, rule)
  let next = (current ?? 0) + direction * rule.step
  if (rule.min !== undefined) {
    next = Math.max(next, rule.min)
  }
  if (rule.max !== undefined) {
    next = Math.min(next, rule.max)
  }
  const shown = text.includes(",")
    ? text.length - text.lastIndexOf(",") - 1
    : digitsOf(current ?? 0)
  const limit = rule.plain ? 10 : rule.decimals
  const digits = Math.min(Math.max(shown, digitsOf(rule.step)), limit)
  next = Number(next.toFixed(digits))
  if (rule.plain) {
    return String(next)
  }
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: Math.min(shown, limit),
    maximumFractionDigits: limit,
    useGrouping: /^[-−]?\d{1,3}(\.\d{3})+(,\d*)?$/.test(text.trim()),
  }).format(next)
}
