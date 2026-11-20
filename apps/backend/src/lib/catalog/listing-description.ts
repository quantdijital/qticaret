import type { ContentDoc } from "../content/doc"
import { renderDoc } from "../content/render"
import { descriptionChanges, descriptionDocSchema, descriptionTextOf } from "./description"

/**
 * A category's, brand's or collection's description as a content document
 * (adr/0075), held to a product description's set (adr/0055): headings
 * (H2–H4), paragraphs, lists, quotes and tables with bold, italic and safe
 * links; no picture and no product or category card. The record's plain
 * `description` keeps the document's text, written by the server whenever
 * the document is: the meta description's fallback, search, AI and the
 * advisor read it as before.
 */
export const listingDescriptionDoc = descriptionDocSchema("catalog.listing_description_blocks")

/** What a save writes: the document, and the plain text beside it. */
export interface ListingDescriptionChanges {
  doc?: ContentDoc | null
  /** Null where the record's column takes none (a brand's, a collection's): no text. */
  description?: string | null
}

/**
 * A listing description save (adr/0075 §2), as a product's (adr/0055): a
 * document with text is kept and its plain text becomes the description;
 * one without text clears both; null drops the document and keeps the
 * text. `doc` undefined, a save that sends plain text only (an import, a
 * script): its text replaces the description and the document goes, so
 * the two never tell different stories. Only what changes is returned.
 */
export function listingDescriptionChanges(
  asked: { doc?: ContentDoc | null | undefined; text?: string | null | undefined },
  current: { doc: unknown; description: string | null },
  empty: "" | null
): ListingDescriptionChanges {
  const hadDoc = current.doc !== null && current.doc !== undefined
  if (asked.doc === undefined) {
    return asked.text === undefined || !hadDoc ? {} : { doc: null }
  }
  const changes = descriptionChanges(asked.doc, current)
  if (changes.description === undefined) {
    return changes.doc === undefined ? {} : { doc: changes.doc }
  }
  const description = changes.description === "" ? empty : changes.description
  return {
    ...(changes.doc === undefined ? {} : { doc: changes.doc }),
    ...(description === current.description ? {} : { description }),
  }
}

/**
 * A stored document read back under the listing set, as a save checks
 * it: one holding a picture or a card (an import, a script, a hand edit
 * of the row) does not read, so the storefront never draws an outside
 * picture from a description.
 */
function storedDoc(stored: unknown): ContentDoc | null {
  if (stored === null || stored === undefined) {
    return null
  }
  const doc = listingDescriptionDoc.safeParse(stored)
  return doc.success ? doc.data : null
}

/**
 * A stored description document as the storefront shows it, rendered as
 * a page's body is (adr/0019); null without one, or with one that no
 * longer reads as a listing document or holds nothing (the page then
 * shows the plain `description`).
 */
export function listingDescriptionHtml(stored: unknown): string | null {
  const doc = storedDoc(stored)
  const html = doc ? renderDoc(doc) : ""
  return html === "" ? null : html
}

/** A stored document for the panel's editor; null for none or one out of shape. */
export function storedListingDoc(stored: unknown): ContentDoc | null {
  return storedDoc(stored)
}

/**
 * A stored document that still tells the record's plain text: every save
 * through the document writes the text beside it, so a text that no
 * longer matches was changed elsewhere (Medusa's own category route, an
 * import) and the document is stale. Null then, as for none.
 */
export function currentListingDoc(stored: unknown, description: string | null): ContentDoc | null {
  const doc = storedDoc(stored)
  return doc && descriptionTextOf(doc) === (description ?? "") ? doc : null
}
