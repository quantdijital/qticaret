import { AttributesCard } from "@/features/attributes/components/attributes-card"
import { useSectionFindings } from "@/features/content/section-findings"
import type { ProductDetail } from "@/features/products/api/products"
import { DeparturesCard } from "@/features/products/booking/departures-card"
import { AddonsCard } from "./addons-card"
import { CatalogCard } from "./catalog-card"
import { FaqCard } from "./faq-card"
import { OrganizeCard } from "./organize-card"
import { PriceHistoryCard } from "./price-history-card"
import { ProductSeoCard } from "./product-seo-card"
import { PRODUCT_SECTIONS as S, PRODUCT_TARGETS } from "./sections"
import { ShippingCard } from "./shipping-card"
import { useAddonsShown } from "./use-addons-shown"

/** The advisor's findings for one part of the product's page, by its element id. */
function useProductFindings(product: ProductDetail) {
  return useSectionFindings({
    kind: "product",
    id: product.id,
    version: product.updated_at,
    targets: PRODUCT_TARGETS,
  })
}

/**
 * What a product's page holds under its main cards (docs/06 "Ürün
 * sayfası"), each folded to a line that says what is in it: its search
 * appearance, attributes, add-ons and price history. A
 * part the shop does not use is left out. Closed parts keep their
 * fields, so an edit not yet saved survives; each saves on its own.
 */
export function ProductSections({ product }: { product: ProductDetail }) {
  const findings = useProductFindings(product)
  const addons = useAddonsShown(product.id) === true
  return (
    <>
      {/* adr/0076 §9: a dated product's departures, first under the main cards */}
      <DeparturesCard productId={product.id} />
      <ProductSeoCard product={product} fold={findings(S.seo)} />
      <AttributesCard productId={product.id} fold={findings(S.attributes)} />
      {/* adr/0074 §5 madde 4: drawn for a role that may ask for the FAQ draft */}
      <FaqCard productId={product.id} />
      {/* adr/0052: shown while the shop's add-ons are on or the product still has some */}
      {addons ? <AddonsCard productId={product.id} fold={findings(S.addons)} /> : null}
      <PriceHistoryCard productId={product.id} fold={findings(S.priceHistory)} />
    </>
  )
}

/**
 * The narrow column's cards under the SEO advisor (docs/06 "Ürün
 * sayfası"): categories, brand and KDV; catalog details; the parcel (not
 * for a digital product or a service). A line per fact, "Düzenle" opens
 * each in its own dialog; the advisor's findings for each are counted.
 */
export function ProductSideCards({ product }: { product: ProductDetail }) {
  const findings = useProductFindings(product)
  return (
    <>
      <OrganizeCard product={product} findings={findings(S.organize)} />
      <CatalogCard productId={product.id} findings={findings(S.catalog)} />
      <ShippingCard product={product} findings={findings(S.shipping)} />
    </>
  )
}
