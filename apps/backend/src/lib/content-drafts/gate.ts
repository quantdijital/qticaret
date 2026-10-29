import { MIN_PRODUCT_WORDS } from "../seo/advisor"
import { hasSymbolRun, isShouting, repeatedWord, wordCount } from "../seo/advisor/text"
import { SERP_TEXT_LENGTH, fitsSerp } from "../seo/pixel-width"
import { readsAsLink } from "../text/link-like"
import type { DraftKind } from "./prompts"
import { hasPersonalData } from "./redact"

/**
 * Whether a draft is worth offering (adr/0005: "skoru düşükse önerilmez"):
 * the advisor's own rules for its field, and none of what a draft must
 * never carry, a link or what reads as a person's data. Returns what is
 * wrong; an empty list passes.
 */
export function draftProblems(kind: DraftKind, text: string): string[] {
  const problems: string[] = []
  const length = Array.from(text).length
  if (kind === "seo_title" || kind === "seo_description") {
    const field = kind === "seo_title" ? "title" : "description"
    const { min, max } = SERP_TEXT_LENGTH[field]
    if (length < min || length > max || !fitsSerp(field, text)) {
      problems.push("length")
    }
  }
  if (kind === "product_description" && wordCount(text) < MIN_PRODUCT_WORDS) {
    problems.push("too_short")
  }
  if (isShouting(text) || hasSymbolRun(text) || (kind === "seo_title" && repeatedWord(text))) {
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
