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

// A tag: `<` then a letter (or `/` and a letter), up to its `>`; "3 < 5" is text
const TAG = /<\/?[a-z][^<>]*>/gi
// A code fence line, with or without a language
const FENCE = /^\s*```[\w-]*\s*$/gm
// Emphasis and heading marks at the edge of a word or a line
const EMPHASIS = /(\*\*|__|`)(.+?)\1/g
const HEADING = /^\s{0,3}#{1,6}\s+/gm
// Quotes a model wraps a whole answer in
const WRAPPED = /^(["'“”«»])([\s\S]*)(["'“”«»])$/u

/** A service's answer as plain text: tags, fences and emphasis marks dropped. */
export function suggestionText(raw: string): string {
  const text = raw
    .replace(FENCE, "")
    .replace(TAG, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(EMPHASIS, "$2")
    .replace(HEADING, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
  const wrapped = WRAPPED.exec(text)
  return wrapped?.[2] === undefined ? text : wrapped[2].trim()
}

/** What is wrong with a suggestion for this task; an empty list passes. */
export function suggestionProblems(task: AiTask, text: string): string[] {
  if (text.trim() === "") {
    return ["empty"]
  }
  if (task.gate === "seo_title" || task.gate === "seo_description") {
    return draftProblems(task.gate, text)
  }
  const problems: string[] = []
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
