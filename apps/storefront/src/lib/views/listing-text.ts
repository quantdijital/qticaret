import type { ListingTextSettings } from "@qticaret/types"
import { listingTextOf } from "@qticaret/types/listing-text"
import type { ListingTextView } from "@qticaret/ui"
import { paragraphsOf } from "./text"

/** A category's, brand's or collection's text as the backend gives it (adr/0075 §4). */
export interface ListingTextSource {
  /** Its content document's HTML (`description_html`); null: the record has none. */
  html: string | null | undefined
  /** Its plain text (`description`), shown while it has no document. */
  plain: string | null | undefined
}

const htmlOf = (value: string | null | undefined): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

/**
 * The text at a listing's foot (adr/0075 §5): its document's HTML, else
 * its plain text's paragraphs, in the shop's look. Only on the first page
 * (a later page repeats nothing, a filtered first page keeps it); none
 * for a record without words.
 */
export function listingTextView(
  source: ListingTextSource | undefined,
  look: Partial<ListingTextSettings> | null | undefined,
  page: number
): ListingTextView | null {
  if (!source || page !== 1) {
    return null
  }
  const html = htmlOf(source.html)
  const paragraphs = html === null ? paragraphsOf(source.plain) : []
  if (html === null && paragraphs.length === 0) {
    return null
  }
  return { html, paragraphs, look: listingTextOf(look) }
}
