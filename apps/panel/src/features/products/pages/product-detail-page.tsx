import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useCan } from "@/features/auth/api/staff"
import { EditorLayout } from "@/features/content/components/editor-layout"
import { productQuery } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { ProductStatusBadge } from "@/features/products/components/product-status-badge"
import { ProductActions } from "@/features/products/detail/product-actions"
import { MainPartView, SidePartView } from "@/features/products/detail/product-sections"
import { usePartAttention } from "@/features/products/detail/use-product-findings"
import { LayoutSheet } from "@/features/products/layout/layout-sheet"
import { HiddenLine, PartSlot } from "@/features/products/layout/part-slot"
import { usePageLayout } from "@/features/products/layout/use-page-layout"
import { errorText } from "@/lib/errors"

const route = getRouteApi("/_auth/products/$id")

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
 * and the parcel, each edited in place. Every card saves on its own. The
 * shop lays the page out for its team ("Sayfayı düzenle"): each column's
 * order and the parts it hides.
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
  return <ProductPage product={product} back={back} />
}

function ProductPage({
  product,
  back,
}: {
  product: ProductDetail
  back: { to: string; label: string }
}) {
  const attention = usePartAttention(product)
  const page = usePageLayout(attention)
  // The layout is the shop's: whoever may change its settings arranges it
  const canArrange = useCan("settings")
  const slot = (key: Parameters<typeof page.shownWhy>[0]) => {
    const why = page.shownWhy(key)
    return why === "off" ? undefined : why
  }
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={product.title}
        badge={<ProductStatusBadge status={product.status} />}
        back={back}
        action={
          <ProductActions
            product={product}
            onCustomize={
              canArrange
                ? () => {
                    page.setDraft(page.saved)
                  }
                : undefined
            }
          />
        }
      />
      <EditorLayout
        main={
          <>
            {page.layout.main.map((key) => {
              const why = slot(key)
              return why === undefined ? null : (
                <PartSlot key={key} part={key} why={why}>
                  <MainPartView part={key} product={product} />
                </PartSlot>
              )
            })}
            <HiddenLine parts={page.away} onShow={page.showAll} />
          </>
        }
        side={page.layout.side.map((key) => {
          const why = slot(key)
          return why === undefined ? null : (
            <PartSlot key={key} part={key} why={why}>
              <SidePartView part={key} product={product} onTarget={page.goTo} />
            </PartSlot>
          )
        })}
      />
      <LayoutSheet saved={page.saved} draft={page.draft} onDraft={page.setDraft} />
    </div>
  )
}
