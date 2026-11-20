import type { JSONContent } from "@tiptap/react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { DocumentCard } from "@/features/content/components/document-card"
import { docOfDescription } from "@/features/products/description-doc"

interface ListingDescriptionCardProps {
  /** The text as written; null: the record has plain text only. */
  doc: JSONContent | null
  /** The plain text, opened as its paragraphs while there is no document. */
  text: string | null | undefined
  saving: boolean
  /** Writes the document only; resolves once the cache holds the saved record. */
  save: (doc: JSONContent) => Promise<void>
}

/**
 * A category, brand or collection page's own text (adr/0075) in the
 * product description's editor: headings, lists, quotes, tables, bold,
 * italic and links; no pictures, cards or shop details. A record with
 * plain text only opens as its paragraphs, and saving writes its document
 * (the move from plain text happens here, on the shop's save). The
 * storefront draws it at the foot of the page, after the products.
 */
export function ListingDescriptionCard({ doc, text, saving, save }: ListingDescriptionCardProps) {
  const { t } = useTranslation()
  // One object per stored text: the editor puts a new one in only when it changes
  const stored = useMemo(() => doc ?? docOfDescription(text), [doc, text])
  return (
    <DocumentCard
      title={t("content.listingDescription.title")}
      description={t("content.listingDescription.hint")}
      stored={stored}
      saving={saving}
      media={false}
      shopTokens={false}
      save={save}
    />
  )
}
