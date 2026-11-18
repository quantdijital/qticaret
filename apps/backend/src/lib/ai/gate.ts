import { hasSymbolRun, isShouting } from "../seo/advisor/text"
import { readsAsLink } from "../text/link-like"
import { altTextProblems } from "./alt-gate"
import { fieldProblems } from "./field-rules"
import { hasPersonalData } from "./redact"
import type { AiTask } from "./registry/tasks"
import {
  focusKeywordProblems,
  keywordLines,
  productTitleProblems,
  productTitleText,
} from "./short-text-gate"

/**
 * The output gate, per task (adr/0071 §9). A service's text is plain
 * text: markup is taken out before anything else, and it is never printed
 * as HTML. SEO fields and a product's description go through the rule
 * engine's own rules (`fieldProblems`); other text through what no suggestion
 * may carry. A suggestion with a problem is recorded as refused and never
 * offered.
 */

/** What is read of an answer at all; the rest is cut before any pattern runs. */
export const MAX_SUGGESTION_CHARS = 20_000

// A tag: `<` then a letter (or `/` and a letter), up to its `>`; "3 < 5" is text
const TAG = /<\/?[a-z][^<>]*>/gi
// What is left of a tag that never closed (`<img src=x onerror=…`): refused, not cleaned
const MARKUP_LEFT = /<[a-z/!?]/i
// A code fence line, with or without a language; tested on one trimmed line
const FENCE = /^```[\w-]*$/
// Emphasis marks around words, on one line
const EMPHASIS = /(\*\*|__|`)(.+?)\1/g
const HEADING = /^#{1,6}\s+/
// A run of non-space characters no word or number of a description reaches (adr/0071 §9);
// tested before the link and personal data patterns, whose cost grows with such a run
export const MAX_UNBROKEN_RUN = 60
const UNBROKEN = new RegExp(`\\S{${String(MAX_UNBROKEN_RUN + 1)}}`)
// `NAME_MASK` as sent, or as a model may rewrite its ellipsis
const MASK_LEFT = /\[\s*(?:…|\.{3})\s*\]/
// Quotes a model wraps a whole answer in
const QUOTES = new Set(['"', "'", "“", "”", "«", "»"])

function cleanLine(line: string): string {
  return line
    .replace(TAG, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(EMPHASIS, "$2")
    .replace(/[ \t]+/g, " ")
    .trim()
    .replace(HEADING, "")
}

/**
 * A service's answer as plain text: tags, fences and emphasis marks
 * dropped, blank lines closed up. Line by line, so a long run of spaces
 * or newlines costs one pass.
 */
export function suggestionText(raw: string): string {
  const text = raw
    .slice(0, MAX_SUGGESTION_CHARS)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !FENCE.test(line))
    .map(cleanLine)
    .filter((line) => line !== "")
    .join("\n")
  const first = text.charAt(0)
  const last = text.charAt(text.length - 1)
  return text.length >= 2 && QUOTES.has(first) && QUOTES.has(last) ? text.slice(1, -1).trim() : text
}

/**
 * A service's answer as the task offers it: plain text (`suggestionText`),
 * then a short text's own shape, a keyword per line or a name without
 * its quotes (lib/ai/short-text-gate.ts).
 */
export function suggestionTextFor(task: AiTask, raw: string): string {
  const text = suggestionText(raw)
  if (task.gate === "focus_keyword") {
    return keywordLines(text).join("\n")
  }
  return task.gate === "product_title" ? productTitleText(text) : text
}

/**
 * What is wrong with a suggestion for this task; an empty list passes.
 * `data` is the data block the call was sent: a product name is held
 * against it (no word it does not hold).
 */
export function suggestionProblems(task: AiTask, text: string, data?: string): string[] {
  if (text.trim() === "") {
    return ["empty"]
  }
  const problems: string[] = []
  // First, and on the length alone: nothing below scans a text longer than the task allows
  if (text.length > task.maxLength * 2 || Array.from(text).length > task.maxLength) {
    return ["length"]
  }
  if (MARKUP_LEFT.test(text)) {
    problems.push("markup")
  }
  const seo = task.gate === "seo_title" || task.gate === "seo_description"
  // Long-form text only: an SEO field is short enough for its patterns, and its rules stay as they are
  if (!seo && UNBROKEN.test(text)) {
    return [...problems, "noise"]
  }
  if (
    task.gate === "seo_title" ||
    task.gate === "seo_description" ||
    task.gate === "product_description"
  ) {
    return [...problems, ...fieldProblems(task.gate, text)]
  }
  if (task.gate === "focus_keyword") {
    return [...problems, ...focusKeywordProblems(text)]
  }
  if (task.gate === "product_title") {
    return [...problems, ...productTitleProblems(text, data)]
  }
  if (task.gate === "image_alt") {
    problems.push(...altTextProblems(text))
  }
  // A masked name echoed back (lib/ai/mask-names.ts): a draft with a hole in it, never offered
  if (task.gate === "plain_text" && MASK_LEFT.test(text)) {
    problems.push("masked_name")
  }
  if (isShouting(text) || hasSymbolRun(text)) {
    problems.push("noise")
  }
  if (readsAsLink(text)) {
    problems.push("link")
  }
  if (hasPersonalData(text)) {
    problems.push("personal_data")
  }
  return problems
}
