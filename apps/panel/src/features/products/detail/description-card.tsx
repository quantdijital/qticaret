import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { AiButton } from "@/features/ai/components/ai-button"
import { DocumentCard } from "@/features/content/components/document-card"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { docOfDescription, docOfParagraphs } from "@/features/products/description-doc"
import { SUGGESTED_WORDS } from "@/features/products/wizard/readiness"

/** The ready lengths the AI core writes a description in (docs/22 PR 2-1); no prompt to write. */
const AI_OPTIONS = ["short", "detailed"] as const

/**
 * The product's long description in the content editor (ADR-0055):
 * headings, lists, quotes, tables, bold, italic and links; no pictures or
 * cards (the gallery shows the product) and no shop details. A product with
 * plain text only opens as its paragraphs. Saved as a whole through the
 * catalog fields; the server writes the plain text the meta description,
 * structured data, feeds and search use. The AI button beside the title
 * (adr/0071 §13) puts a suggestion in as plain paragraphs, a change the
 * card's Save writes; nothing is written before.
 */
export function ProductDescriptionCard({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const catalog = useQuery(productCatalogQuery(product.id))
  const save = useSaveCatalog(product.id)
  const doc = catalog.data?.description_doc ?? null
  // One object per stored text: the editor puts a new one in only when it changes
  const stored = useMemo(
    () => doc ?? docOfDescription(product.description),
    [doc, product.description]
  )
  if (!catalog.data) {
    return <Skeleton className="h-96 w-full rounded-lg" />
  }
  return (
    <DocumentCard
      title={t("products.detail.description")}
      description={t("products.detail.descriptionHint", { suggested: SUGGESTED_WORDS })}
      stored={stored}
      saving={save.isPending}
      media={false}
      shopTokens={false}
      save={async (description_doc) => {
        await save.mutateAsync({ description_doc })
      }}
      action={(put) => (
        <AiButton
          task="product_description"
          entity={{ type: "product", id: product.id }}
          options={AI_OPTIONS}
          label={t("products.detail.aiDescription")}
          onUse={(text) => {
            put(docOfParagraphs(text))
          }}
        />
      )}
    />
  )
}
