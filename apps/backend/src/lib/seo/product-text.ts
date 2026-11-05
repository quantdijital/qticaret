import { summaryText } from "../catalog/summary"
import { SHORT_EXCERPT, excerpt, plainText } from "./resolve"

/**
 * A product's texts where its short description (adr/0055 Ek 2026-11-05)
 * stands in for what the shop did not write. Pure.
 */

/**
 * The `kısa_açıklama` token (docs/13 §3): the short description's lines
 * as sentences within 140 characters (the template puts its own full
 * stop), else the subtitle, else the description's first sentences.
 */
export function shortDescription(
  summary: readonly string[],
  subtitle: string,
  description: string
): string {
  const lines = summaryText(summary, SHORT_EXCERPT).replace(/\.$/u, "")
  return lines !== "" ? lines : subtitle !== "" ? subtitle : excerpt(description, SHORT_EXCERPT)
}

/** What JSON-LD and the feeds say of a product: its description, else its short description. */
export const productText = (description: string, summary: readonly string[]): string =>
  plainText(description) || summaryText(summary)
