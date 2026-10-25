import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState } from "@/components/patterns/states"
import { Skeleton } from "@/components/ui/skeleton"
import { productQuery } from "@/features/products/api/products"
import { AttributesCard } from "@/features/attributes/components/attributes-card"
import { ProductSeoCard } from "@/features/products/detail/product-seo-card"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { CatalogCard } from "@/features/products/detail/catalog-card"
import { GeneralCard } from "@/features/products/detail/general-card"
import { MediaCard } from "@/features/products/detail/media-card"
import { OrganizeCard } from "@/features/products/detail/organize-card"
import { ProductActions } from "@/features/products/detail/product-actions"
import { ShippingCard } from "@/features/products/detail/shipping-card"
import { SummaryCard } from "@/features/products/detail/summary-card"
import { VariantsCard } from "@/features/products/detail/variants-card"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/products/$id")

function DetailSkeleton() {
  return (
    <div className="grid gap-[var(--grid-gap)] xl:grid-cols-12">
      <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-8">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
      <div className="flex flex-col gap-[var(--grid-gap)] xl:col-span-4">
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  )
}

/**
 * One product (docs/06 §4): what it is on the left, how it is sold and
 * shipped on the right; every card saves on its own.
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title={product.title}
        badge={<ProductStatusBadge status={product.status} />}
        back={back}
        action={<ProductActions product={product} />}
      />
      <div className="grid items-start gap-[var(--grid-gap)] xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:col-span-8">
          <GeneralCard product={product} />
          <MediaCard product={product} />
          <VariantsCard product={product} />
          <AttributesCard productId={product.id} />
          <ProductSeoCard product={product} />
        </div>
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:col-span-4">
          <SummaryCard product={product} />
          <OrganizeCard product={product} />
          <ShippingCard product={product} />
          <CatalogCard productId={product.id} />
        </div>
      </div>
    </div>
  )
}
