import { descriptionTextOf } from "../catalog/description"
import type { ContentDoc } from "../content/doc"
import { hasText } from "../content/plain"
import type { BodyOptions } from "./sources/wordpress/html"
import { bodyBlocks, documentOf } from "./sources/wordpress/html"

/**
 * A source's HTML product description (a WooCommerce body, Shopify's
 * `descriptionHtml`) as the product keeps it (adr/0055): a content
 * document with its headings, paragraphs, lists, quotes and tables, and
 * the document's plain text for `description`. The WordPress body
 * converter reads any HTML the same way (one linear scan, tags only ever
 * dropped or mapped); WordPress's shortcodes are read only where the
 * source is WordPress. A body without text is none.
 */

export interface SourceDescription {
  doc: ContentDoc | null
  text: string | null
  /** The body was past the document's bounds and cut at a block. */
  cut: boolean
}

export function descriptionOf(
  html: string,
  options: BodyOptions & { shortcodes?: boolean } = {}
): SourceDescription {
  const { doc, cut } = documentOf(bodyBlocks(html, options).blocks)
  return hasText(doc)
    ? { doc, text: descriptionTextOf(doc), cut }
    : { doc: null, text: null, cut: false }
}
