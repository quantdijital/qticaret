import type { ReactNode } from "react"
import type { ProductDetail } from "@/features/products/api/products"
import { DeparturesCard } from "@/features/products/booking/departures-card"
import type { MainPart, PartKey, SidePart } from "@/features/products/layout/parts"
import type { ShownWhy } from "@/features/products/layout/use-page-layout"
import { ProgramCard } from "@/features/products/program/program-card"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { DataCard } from "./data-card"
import { ProductDescriptionCard } from "./description-card"
import { FaqCard } from "./faq-card"
import { GeneralCard } from "./general-card"
import { MediaCard } from "./media-card"
import { OrganizeCard } from "./organize-card"
import { ProductSeoCard } from "./product-seo-card"
import { PRODUCT_SECTIONS as S, PRODUCT_TARGETS } from "./sections"
import { ProductShortDescriptionCard } from "./short-description-card"
import { SummaryCard } from "./summary-card"
import type { DataCardState } from "./use-data-card"
import type { PartMark } from "./use-product-findings"
import { useProductFindings } from "./use-product-findings"

/** A main card's anchor: the advisor's "go to field" lands on it, its top in sight. */
function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="flex min-w-0 scroll-mt-20 flex-col">
      {children}
    </div>
  )
}

/** What the "Ürün verileri" card needs of the page: its state and how the page draws its tabs. */
export interface DataCardProps {
  state: DataCardState
  slot: (key: PartKey) => ShownWhy | null | undefined
  draws: (key: PartKey) => boolean
  marks: (key: PartKey) => PartMark
}

/**
 * One part of the product page's main column (docs/06 "Ürün sayfası"):
 * the main cards, the "Ürün verileri" card with its tabs, then the parts
 * folded to a line that says what is in them. A part the shop does not
 * use draws nothing (a product not sold by departure). Each saves on its
 * own.
 */
export function MainPartView({
  part,
  product,
  data,
}: {
  part: MainPart
  product: ProductDetail
  data: DataCardProps
}) {
  const findings = useProductFindings(product)
  switch (part) {
    case "general":
      return (
        <Anchor id="product-general">
          <GeneralCard product={product} />
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
    case "data":
      return <DataCard product={product} {...data} />
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
    case "faq":
      // adr/0074 §5 madde 4: drawn for a role that may ask for the FAQ draft
      return <FaqCard productId={product.id} />
  }
}

/**
 * One part of the narrow column: the product's facts, the SEO advisor,
 * and its categories, tags, brand and KDV, edited in place.
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
  }
}
