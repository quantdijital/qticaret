import { draftProblems } from "../content-drafts/gate"
import { hasPersonalData } from "../content-drafts/redact"
import { hasSymbolRun, isShouting } from "../seo/advisor/text"
import { readsAsLink } from "../text/link-like"
import type { AiTask } from "./registry/tasks"

/**
 * The output gate, per task (adr/0071 §9). A service's text is plain
 * text: markup is taken out before anything else, and it is never printed
 * as HTML. SEO fields go through the rule engine's own rules
 * (`draftProblems`, used as it is); other text through what no suggestion
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

/** What is wrong with a suggestion for this task; an empty list passes. */
export function suggestionProblems(task: AiTask, text: string): string[] {
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
  if (task.gate === "seo_title" || task.gate === "seo_description") {
    return [...problems, ...draftProblems(task.gate, text)]
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
