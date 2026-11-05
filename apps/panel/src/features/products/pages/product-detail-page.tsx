import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { revealSection } from "@/components/patterns/use-section-open"
import { Skeleton } from "@/components/ui/skeleton"
import { EditorLayout } from "@/features/content/components/editor-layout"
import { productQuery } from "@/features/products/api/products"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductDescriptionCard } from "@/features/products/detail/description-card"
import { GeneralCard } from "@/features/products/detail/general-card"
import { MediaCard } from "@/features/products/detail/media-card"
import { ProductActions } from "@/features/products/detail/product-actions"
import { ProductSections, ProductSideCards } from "@/features/products/detail/product-sections"
import { PRODUCT_TARGETS } from "@/features/products/detail/sections"
import { ProductShortDescriptionCard } from "@/features/products/detail/short-description-card"
import { SummaryCard } from "@/features/products/detail/summary-card"
import { VariantsCard } from "@/features/products/detail/variants-card"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/products/$id")

/** A main card's anchor: the advisor's "go to field" lands on it, its top in sight. */
function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="flex min-w-0 scroll-mt-20 flex-col">
      {children}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <PageGrid>
      <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-8">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-4">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </PageGrid>
  )
}

/**
 * One product (docs/06 "Ürün sayfası"): what is edited most first (its
 * name and address, its variants, each opening in a dialog, its pictures,
 * its description), its search appearance and seldom-edited parts folded
 * under them to a line each; beside them, following the scroll, its
 * facts, the SEO advisor and short cards for categories, catalog details
 * and the parcel, each edited in a dialog. Every card saves on its own.
 */
export function ProductDetailPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const query = useQuery(productQuery(id))
  const product = query.data
  const back = { to: "/products", label: t("nav.products") }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("products.detail.title")} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  if (!product) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("common.loading")} back={back} />
        <DetailSkeleton />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={product.title}
        badge={<ProductStatusBadge status={product.status} />}
        back={back}
        action={<ProductActions product={product} />}
      />
      <EditorLayout
        main={
          <>
            <Anchor id="product-general">
              <GeneralCard product={product} />
            </Anchor>
            <Anchor id="product-variants">
              <VariantsCard product={product} />
            </Anchor>
            <Anchor id="product-media">
              <MediaCard product={product} />
            </Anchor>
            <Anchor id="product-description">
              <ProductDescriptionCard product={product} />
            </Anchor>
            {/* ADR-0055 Ek 2026-11-06: under the long description, as WordPress has it */}
            <Anchor id="product-short-description">
              <ProductShortDescriptionCard product={product} />
            </Anchor>
            <ProductSections product={product} />
          </>
        }
        side={
          <>
            <SummaryCard product={product} />
            <AdvisorCard
              kind="product"
              id={product.id}
              version={product.updated_at}
              targets={PRODUCT_TARGETS}
              onTarget={revealSection}
            />
            <ProductSideCards product={product} />
          </>
        }
      />
    </div>
  )
}
