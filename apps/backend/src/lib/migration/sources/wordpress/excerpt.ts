import { summaryFromBlocks } from "../../../catalog/summary-fit"
import type { SummaryDoc } from "../../../catalog/summary"
import type { BodyOptions } from "./html"
import { bodyBlocks } from "./html"

/**
 * A WooCommerce product's short description (`excerpt:encoded`) as the
 * product's short description (adr/0055 Ek 2026-11-06), as the shop wrote
 * it: read with the body's converter (tags only ever dropped or mapped),
 * then held to the short slot's set (`lib/catalog/summary-fit`). Nothing
 * is split into bullets or shortened; `cut`: past the 1,500-character cap
 * (the report names the product).
 */

export interface ExcerptSummary {
  doc: SummaryDoc
  cut: boolean
}

/** The excerpt as a short description; null for an excerpt without text. */
export function summaryFromExcerpt(html: string, options: BodyOptions = {}): ExcerptSummary | null {
  if (html.trim() === "") {
    return null
  }
  const { doc, cut } = summaryFromBlocks(bodyBlocks(html, options).blocks)
  return doc ? { doc, cut } : null
}
