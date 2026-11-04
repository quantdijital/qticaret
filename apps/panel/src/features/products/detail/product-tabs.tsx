import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageTabs } from "@/components/patterns/page-tabs"
import type { PageTab } from "@/components/patterns/page-tabs"
import { AttributesCard } from "@/features/attributes/components/attributes-card"
import { useDraftsShown } from "@/features/products/api/content-drafts"
import type { ProductDetail } from "@/features/products/api/products"
import { AddonsCard } from "./addons-card"
import { CatalogCard } from "./catalog-card"
import { ContentDraftsCard } from "./content-drafts-card"
import { PriceHistoryCard } from "./price-history-card"
import { useAddonsShown } from "./use-addons-shown"
import { VariantImagesCard } from "./variant-images-card"

const T = "products.detail.tabs"

/**
 * What a product's page holds under its main cards (docs/06 "Detay
 * sayfası düzeni"), one card per tab: its attributes, its catalog
 * details, the pictures of each variant, its add-ons, its price history
 * and its content drafts; a tab whose card the shop does not use is left
 * out. Every tab stays mounted, so an edit not yet saved in one survives
 * a look at another.
 */
export function ProductTabs({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const addons = useAddonsShown(product.id) === true
  const drafts = useDraftsShown(product.id)
  const variantImages = (product.variants?.length ?? 0) > 1 && (product.images?.length ?? 0) > 0
  const tab = (key: string, id: string | null, content: ReactNode): PageTab => ({
    key,
    label: t(`${T}.${key}`),
    // An anchor for the advisor's jumps (the page's `TAB_OF_TARGET`)
    content: id ? (
      <div id={id} className="scroll-mt-20">
        {content}
      </div>
    ) : (
      content
    ),
  })
  const tabs: PageTab[] = [
    tab("attributes", "product-attributes", <AttributesCard productId={product.id} />),
    tab("catalog", null, <CatalogCard productId={product.id} />),
    ...(variantImages
      ? [tab("variantImages", "product-variant-images", <VariantImagesCard product={product} />)]
      : []),
    // adr/0052: shown while the shop's add-ons are on or the product still has some
    ...(addons ? [tab("addons", "product-addons", <AddonsCard productId={product.id} />)] : []),
    tab("priceHistory", "product-price-history", <PriceHistoryCard productId={product.id} />),
    ...(drafts ? [tab("drafts", null, <ContentDraftsCard productId={product.id} />)] : []),
  ]
  return <PageTabs tabs={tabs} label={t(`${T}.label`)} keepMounted />
}
