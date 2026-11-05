import { SHORT_EXCERPT, excerpt, plainText } from "./resolve"

/**
 * A product's texts where its short description (adr/0055 Ek 2026-11-06)
 * stands in for what the shop did not write: its plain text, one line
 * (`lib/catalog/summary` `summaryText`). Pure.
 */

/**
 * The `kısa_açıklama` token (docs/13 §3): the short description within
 * 140 characters, cut at a word (the template puts its own full stop),
 * else the subtitle, else the description's first sentences.
 */
export function shortDescription(summary: string, subtitle: string, description: string): string {
  const own = excerpt(summary, SHORT_EXCERPT).replace(/\.$/u, "")
  return own !== "" ? own : subtitle !== "" ? subtitle : excerpt(description, SHORT_EXCERPT)
}

/** What JSON-LD and the feeds say of a product: its description, else its short description. */
export const productText = (description: string, summary: string): string =>
  plainText(description) || summary
