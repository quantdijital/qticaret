import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { DocumentCard } from "@/features/content/components/document-card"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { EMPTY_SUMMARY, SUMMARY_TEXT_MAX } from "@/features/products/summary-doc"

/**
 * The product's short description (ADR-0055 Ek 2026-11-06; the owner:
 * "'Kısa açıklama' diye normal açıklama gibi bir alan aç, editör gibi;
 * WordPress'te öyledir"): its own card under the long description, as
 * WordPress has it, in the same editor with a shorter start that grows with
 * the text. Paragraphs, h3–h4 headings, lists, bold, italic and links to
 * the shop or https; no quotes, tables or pictures (they would crowd the
 * slot above the price). Characters counted against the server's 1,500.
 * Optional; saved through the catalog fields, an emptied one clears it.
 */
export function ProductShortDescriptionCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const catalog = useQuery(productCatalogQuery(product.id))
  const save = useSaveCatalog(product.id)
  if (!catalog.data) {
    return <Skeleton className="h-56 w-full rounded-lg" />
  }
  return (
    <DocumentCard
      title={t("products.detail.shortDescription")}
      description={t("products.detail.shortDescriptionHint")}
      stored={catalog.data.summary_doc ?? EMPTY_SUMMARY}
      saving={save.isPending}
      media={false}
      shopTokens={false}
      short
      maxChars={SUMMARY_TEXT_MAX}
      placeholder={t("products.detail.shortDescriptionPlaceholder")}
      save={async (summary_doc) => {
        await save.mutateAsync({ summary_doc })
      }}
    />
  )
}
