import { useUpdateTerm } from "@/features/content/api/terms"
import type { Term } from "@/features/content/api/terms"
import { ListingDescriptionCard } from "@/features/content/components/listing-description-card"

/** The server's cap on a term's text (adr/0075 Ek 2026-11-24): an archive's foot, not a page. */
const TERM_TEXT_MAX = 5000

/**
 * A blog category's or tag's own text (adr/0075 Ek 2026-11-24) in a
 * product category's editor: headings, lists, quotes, tables, bold,
 * italic and links, pasted ones kept. A term with plain text only opens
 * as its paragraphs; saving writes the document (the server keeps its
 * plain text, the search result's fallback). The storefront draws it at
 * the foot of the archive, after the posts.
 */
export function TermDescriptionCard({
  term,
  onDirtyChange,
}: {
  term: Term
  onDirtyChange?: (dirty: boolean) => void
}) {
  const update = useUpdateTerm(term.id)
  return (
    <ListingDescriptionCard
      kind={term.kind === "category" ? "post_category" : "post_tag"}
      id={term.id}
      doc={term.description_doc}
      text={term.description}
      saving={update.isPending}
      maxChars={TERM_TEXT_MAX}
      save={async (doc) => {
        await update.mutateAsync({ description_doc: doc })
      }}
      {...(onDirtyChange ? { onDirtyChange } : {})}
    />
  )
}
