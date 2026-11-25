import type { ReactNode } from "react"
import { AttributesCard } from "@/features/attributes/components/attributes-card"
import type { ProductDetail } from "@/features/products/api/products"
import { DeparturesCard } from "@/features/products/booking/departures-card"
import type { MainPart, SidePart } from "@/features/products/layout/parts"
import { ProgramCard } from "@/features/products/program/program-card"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { AddonsCard } from "./addons-card"
import { CatalogCard } from "./catalog-card"
import { ProductDescriptionCard } from "./description-card"
import { FaqCard } from "./faq-card"
import { GeneralCard } from "./general-card"
import { MediaCard } from "./media-card"
import { OrganizeCard } from "./organize-card"
import { PriceHistoryCard } from "./price-history-card"
import { ProductSeoCard } from "./product-seo-card"
import { PRODUCT_SECTIONS as S, PRODUCT_TARGETS } from "./sections"
import { ShippingCard } from "./shipping-card"
import { ProductShortDescriptionCard } from "./short-description-card"
import { SummaryCard } from "./summary-card"
import { useAddonsShown } from "./use-addons-shown"
import { useProductFindings } from "./use-product-findings"
import { VariantsCard } from "./variants-card"

/** A main card's anchor: the advisor's "go to field" lands on it, its top in sight. */
function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="flex min-w-0 scroll-mt-20 flex-col">
      {children}
    </div>
  )
}

/**
 * One part of the product page's main column (docs/06 "Ürün sayfası"):
 * the main cards, then the parts folded to a line that says what is in
 * them. A part the shop does not use draws nothing (add-ons off, a
 * product not sold by departure). Each saves on its own.
 */
export function MainPartView({ part, product }: { part: MainPart; product: ProductDetail }) {
  const findings = useProductFindings(product)
  const addons = useAddonsShown(product.id) === true
  switch (part) {
    case "general":
      return (
        <Anchor id="product-general">
          <GeneralCard product={product} />
        </Anchor>
      )
    case "variants":
      return (
        <Anchor id="product-variants">
          <VariantsCard product={product} />
        </Anchor>
      )
    case "media":
      return (
        <Anchor id="product-media">
          <MediaCard product={product} />
        </Anchor>
      )
    case "description":
      return (
        <Anchor id="product-description">
          <ProductDescriptionCard product={product} />
        </Anchor>
      )
    case "shortDescription":
      // ADR-0055 Ek 2026-11-06: under the long description, as WordPress has it
      return (
        <Anchor id="product-short-description">
          <ProductShortDescriptionCard product={product} />
        </Anchor>
      )
    case "departures":
      // adr/0076 §9: a dated product's departures
      return <DeparturesCard productId={product.id} />
    case "program":
      // adr/0078: its program, the steps its page shows
      return <ProgramCard productId={product.id} />
    case "seo":
      return <ProductSeoCard product={product} fold={findings(S.seo)} />
    case "attributes":
      return <AttributesCard productId={product.id} fold={findings(S.attributes)} />
    case "faq":
      // adr/0074 §5 madde 4: drawn for a role that may ask for the FAQ draft
      return <FaqCard productId={product.id} />
    case "addons":
      // adr/0052: shown while the shop's add-ons are on or the product still has some
      return addons ? <AddonsCard productId={product.id} fold={findings(S.addons)} /> : null
    case "priceHistory":
      return <PriceHistoryCard productId={product.id} fold={findings(S.priceHistory)} />
  }
}

/**
 * One part of the narrow column: the product's facts, the SEO advisor,
 * and short cards for categories, brand and KDV, catalog details and the
 * parcel (not for a digital product or a service), each edited in place.
 */
export function SidePartView({
  part,
  product,
  onTarget,
}: {
  part: SidePart
  product: ProductDetail
  /** The advisor's "Alana git". */
  onTarget: (target: string) => void
}) {
  const findings = useProductFindings(product)
  switch (part) {
    case "summary":
      return <SummaryCard product={product} />
    case "advisor":
      return (
        <AdvisorCard
          kind="product"
          id={product.id}
          version={product.updated_at}
          targets={PRODUCT_TARGETS}
          onTarget={onTarget}
        />
      )
    case "organize":
      return <OrganizeCard product={product} findings={findings(S.organize)} />
    case "catalog":
      return <CatalogCard productId={product.id} findings={findings(S.catalog)} />
    case "shipping":
      return <ShippingCard product={product} findings={findings(S.shipping)} />
  }
}
