import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { spanOf } from "@/components/patterns/page-spans"
import type { Span } from "@/components/patterns/page-spans"
import { useOpenPart } from "@/components/patterns/use-open-part"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { productQuery } from "@/features/products/api/products"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductDescriptionCard } from "@/features/products/detail/description-card"
import { GeneralCard } from "@/features/products/detail/general-card"
import { MediaCard } from "@/features/products/detail/media-card"
import { OrganizeCard } from "@/features/products/detail/organize-card"
import { ProductActions } from "@/features/products/detail/product-actions"
import { ProductSeoCard } from "@/features/products/detail/product-seo-card"
import { ProductTabs } from "@/features/products/detail/product-tabs"
import { ShippingCard } from "@/features/products/detail/shipping-card"
import { SummaryCard } from "@/features/products/detail/summary-card"
import { VariantsCard } from "@/features/products/detail/variants-card"
import { AdvisorCard } from "@/features/seo/advisor/advisor-card"
import { scrollToTarget } from "@/features/seo/advisor/scroll-to-target"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

// Where each of the advisor's manual fixes takes the person on this page
const ADVISOR_TARGETS = {
  edit_title: "product-seo",
  edit_description: "product-seo",
  edit_robots: "product-seo",
  edit_body: "product-description",
  edit_handle: "product-general",
  add_images: "product-media",
  add_alt_text: "product-media",
  edit_prices: "product-variants",
  edit_codes: "product-variants",
  edit_attributes: "product-attributes",
  edit_brand: "product-organize",
  edit_categories: "product-organize",
  edit_dimensions: "product-shipping",
}

// The tab each of the advisor's jumps lands in (`ProductTabs`); the rest are on the page itself
const TAB_OF_TARGET: Readonly<Record<string, string>> = {
  "product-attributes": "attributes",
}

const route = getRouteApi("/_auth/products/$id")

/** A card's place in the page's grid, an anchor for the advisor; the card fills its row. */
function Cell({ id, span, children }: { id?: string; span: Span; children: ReactNode }) {
  return (
    <div
      id={id}
      className={cn("flex min-w-0 scroll-mt-20 flex-col [&>section]:flex-1", spanOf(span))}
    >
      {children}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
      <Skeleton className="h-64 rounded-lg xl:col-span-8" />
      <Skeleton className="h-64 rounded-lg xl:col-span-4" />
      <Skeleton className="h-80 rounded-lg xl:col-span-8" />
      <Skeleton className="h-80 rounded-lg xl:col-span-4" />
    </div>
  )
}

/**
 * One product (docs/06 "Detay sayfası düzeni"): what is edited most, in
 * pairs of cards that end on one line (its name beside its summary, its
 * text beside where it is listed, its prices and stock beside its
 * parcel), its pictures the page's width, its search listing beside the
 * SEO advisor; then its attributes, catalog details, variant pictures,
 * add-ons, price history and drafts, one tab each. Every card saves on
 * its own.
 */
export function ProductDetailPage() {
  const { t } = useTranslation()
  const { id } = route.useParams()
  const query = useQuery(productQuery(id))
  const openPart = useOpenPart()
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
  // A field in a tab: its tab opens first, then the page goes to it
  const goTo = (target: string) => {
    const part = TAB_OF_TARGET[target]
    if (!part) {
      scrollToTarget(target)
      return
    }
    void openPart(part).then(() => {
      requestAnimationFrame(() => {
        scrollToTarget(target)
      })
    })
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={product.title}
        {...(product.created_at && product.updated_at
          ? {
              description: t("products.detail.dates", {
                created: formatDateTime(product.created_at),
                updated: formatDateTime(product.updated_at),
              }),
            }
          : {})}
        badge={<ProductStatusBadge status={product.status} />}
        back={back}
        action={<ProductActions product={product} />}
      />
      <PageGrid>
        <Cell id="product-general" span={8}>
          <GeneralCard product={product} />
        </Cell>
        <Cell span={4}>
          <SummaryCard product={product} />
        </Cell>
        <Cell id="product-description" span={8}>
          <ProductDescriptionCard product={product} />
        </Cell>
        <Cell id="product-organize" span={4}>
          <OrganizeCard product={product} />
        </Cell>
        <Cell id="product-variants" span={8}>
          <VariantsCard product={product} />
        </Cell>
        <Cell id="product-shipping" span={4}>
          <ShippingCard product={product} />
        </Cell>
        <Cell id="product-media" span={12}>
          <MediaCard product={product} />
        </Cell>
        {/* The search listing beside its score (docs/06: the advisor is a side panel, not a tab) */}
        <Cell id="product-seo" span={8}>
          <ProductSeoCard product={product} />
        </Cell>
        <Cell span={4}>
          <AdvisorCard
            kind="product"
            id={product.id}
            version={product.updated_at}
            targets={ADVISOR_TARGETS}
            onTarget={goTo}
          />
        </Cell>
      </PageGrid>
      <ProductTabs product={product} />
    </div>
  )
}
