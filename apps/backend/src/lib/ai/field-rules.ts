import { MIN_PRODUCT_WORDS } from "../seo/advisor"
import { hasSymbolRun, isShouting, repeatedWord, wordCount } from "../seo/advisor/text"
import { SERP_TEXT_LENGTH, fitsSerp } from "../seo/pixel-width"
import { readsAsLink } from "../text/link-like"
import { hasPersonalData } from "./redact"

/**
 * The fields a suggestion fills that the SEO rule engine has rules for:
 * a page's search result title and description, and a product's
 * description (adr/0005, adr/0071 §9).
 */
export const AI_FIELD_RULES = ["seo_title", "seo_description", "product_description"] as const
export type AiFieldRule = (typeof AI_FIELD_RULES)[number]

/**
 * Whether a text is worth offering for its field (adr/0005: "skoru düşükse
 * önerilmez"): the advisor's own rules for the field, and none of what a
 * suggestion must never carry, a link or what reads as a person's data.
 * Returns what is wrong; an empty list passes. Used by the AI core's gate
 * (lib/ai/gate.ts) and, until docs/22 PR 2-2 removes them, by adr/0005's
 * draft routes.
 */
export function fieldProblems(field: AiFieldRule, text: string): string[] {
  const problems: string[] = []
  const length = Array.from(text).length
  if (field === "seo_title" || field === "seo_description") {
    const serp = field === "seo_title" ? "title" : "description"
    const { min, max } = SERP_TEXT_LENGTH[serp]
    if (length < min || length > max || !fitsSerp(serp, text)) {
      problems.push("length")
    }
  }
  if (field === "product_description" && wordCount(text) < MIN_PRODUCT_WORDS) {
    problems.push("too_short")
  }
  if (isShouting(text) || hasSymbolRun(text) || (field === "seo_title" && repeatedWord(text))) {
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
