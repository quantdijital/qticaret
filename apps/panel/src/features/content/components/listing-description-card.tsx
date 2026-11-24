import type { JSONContent } from "@tiptap/react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { AiButton } from "@/features/ai/components/ai-button"
import { DocumentCard } from "@/features/content/components/document-card"
import { docOfDescription, docOfParagraphs } from "@/features/products/description-doc"
import { useAiFill } from "@/features/seo/advisor/ai-fill"

/** A listing page's kind: its description task is the backend's `<kind>_description`. */
export type ListingKind = "category" | "collection" | "brand"

/** A blog category's or tag's archive (adr/0075 Ek 2026-11-24): no AI task writes its text. */
export type BlogTermListingKind = "post_category" | "post_tag"

const isCatalog = (kind: ListingKind | BlogTermListingKind): kind is ListingKind =>
  kind === "category" || kind === "collection" || kind === "brand"

/** The ready lengths the AI core writes a listing's text in (adr/0074 §5); no prompt to write. */
const AI_OPTIONS = ["short", "detailed"] as const

interface ListingDescriptionCardProps {
  /** The page's kind and id: the AI button asks its description for this record (catalog only). */
  kind: ListingKind | BlogTermListingKind
  id: string
  /** The text as written; null: the record has plain text only. */
  doc: JSONContent | null
  /** The plain text, opened as its paragraphs while there is no document. */
  text: string | null | undefined
  saving: boolean
  /** Writes the document only; resolves once the cache holds the saved record. */
  save: (doc: JSONContent) => Promise<void>
  /** Whether the editor holds an unsaved change. */
  onDirtyChange?: (dirty: boolean) => void
}

/**
 * A category, brand or collection page's own text (adr/0075) in the
 * product description's editor: headings, lists, quotes, tables, bold,
 * italic and links; no pictures, cards or shop details. A record with
 * plain text only opens as its paragraphs, and saving writes its document
 * (the move from plain text happens here, on the shop's save). The
 * storefront draws it at the foot of the page, after the products. The AI
 * button beside the title (adr/0074 §5 madde 1) puts a suggestion in as
 * plain paragraphs, a change the card's Save writes; nothing before. A
 * blog category's or tag's text is the same (adr/0075 Ek 2026-11-24),
 * drawn after the posts; it has no AI button.
 */
export function ListingDescriptionCard({
  kind,
  id,
  doc,
  text,
  saving,
  save,
  onDirtyChange,
}: ListingDescriptionCardProps) {
  const { t } = useTranslation()
  // One object per stored text: the editor puts a new one in only when it changes
  const stored = useMemo(() => doc ?? docOfDescription(text), [doc, text])
  return (
    <DocumentCard
      title={t("content.listingDescription.title")}
      description={t(
        isCatalog(kind) ? "content.listingDescription.hint" : "content.listingDescription.hintBlog"
      )}
      stored={stored}
      saving={saving}
      media={false}
      shopTokens={false}
      save={save}
      action={
        isCatalog(kind)
          ? (put) => <ListingDescriptionAi kind={kind} id={id} put={put} />
          : undefined
      }
      onDirtyChange={onDirtyChange}
    />
  )
}

/**
 * The card's AI button, and the receiver of the one on an advisor finding
 * (C/B/K-CONT-01): either way the text goes in as plain paragraphs, an
 * unsaved change of the editor.
 */
function ListingDescriptionAi({
  kind,
  id,
  put,
}: {
  kind: ListingKind
  id: string
  put: (doc: JSONContent) => void
}) {
  const { t } = useTranslation()
  const fill = (text: string) => {
    put(docOfParagraphs(text))
  }
  useAiFill(kind, id, "description", fill)
  return (
    <AiButton
      task={`${kind}_description`}
      entity={{ type: kind, id }}
      options={AI_OPTIONS}
      label={t("content.listingDescription.ai")}
      onUse={fill}
    />
  )
}
