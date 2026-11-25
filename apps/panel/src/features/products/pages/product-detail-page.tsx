import { useQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SectionDefaults } from "@qticaret/admin-ui/hooks/use-section-open"
import { DirtyRegistryProvider } from "@qticaret/admin-ui/patterns/dirty-registry"
import { HeaderSaveActions } from "@qticaret/admin-ui/patterns/header-save-actions"
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
import { usePartDraws } from "@/features/products/detail/use-part-draws"
import { useDataCard } from "@/features/products/detail/use-data-card"
import { usePartAttention, usePartMarks } from "@/features/products/detail/use-product-findings"
import { LayoutSheet } from "@/features/products/layout/layout-sheet"
import { PartNav } from "@/features/products/layout/part-nav"
import type { PartKey } from "@/features/products/layout/parts"
import { HiddenLine, PartSlot } from "@/features/products/layout/part-slot"
import { useGoToCommands } from "@/features/products/layout/use-go-to-commands"
import { usePageLayout } from "@/features/products/layout/use-page-layout"
import { useSideBySide } from "@/features/products/layout/use-side-by-side"
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
 * One product (docs/06 "Ürün sayfası"; WooCommerce's layout): what is
 * edited most first (its name and address, its pictures, its description),
 * the "Ürün verileri" card with its type and tabs (price, stock, parcel,
 * attributes, variants, catalog, add-ons and price history), its search
 * appearance folded to a line; beside them, a narrow column following the
 * scroll with its facts, the SEO advisor and its categories, edited in
 * place. Every form saves on its own and with the page's one "Kaydet" in
 * the header, held under the top bar as the section bar under it. The
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
  const draws = usePartDraws(product.id)
  const data = useDataCard(product)
  const page = usePageLayout(attention, draws, { simple: data.simple, open: data.open })
  const marks = usePartMarks(product)
  const wide = useSideBySide()
  // The layout is the shop's: whoever may change its settings arranges it
  const canArrange = useCan("settings")
  const slot = (key: PartKey) => {
    const why = page.shownWhy(key)
    return why === "off" ? undefined : why
  }
  useGoToCommands({
    layout: page.layout,
    draws,
    goToKey: page.goToKey,
    goTo: page.goTo,
    simple: data.simple,
  })
  const shown = (keys: readonly PartKey[]) => keys.filter((key) => slot(key) !== undefined)
  // Side by side, the bar heads the main column and names its parts; narrower, the whole page's
  const nav = (
    <PartNav
      parts={wide ? shown(page.layout.main) : shown([...page.layout.main, ...page.layout.side])}
      marks={marks}
      wide={wide}
      onGo={page.goToKey}
    />
  )
  // The folded parts the shop has start open ("Gelişmiş"), by their remembered names
  const open = new Set<string>(page.layout.open.map((key) => `product.${key}`))
  return (
    <DirtyRegistryProvider>
      <SectionDefaults value={(name) => (open.has(name) ? true : undefined)}>
        <div className="flex flex-col gap-[var(--grid-gap)]">
          <PageHeader
            title={product.title}
            badge={<ProductStatusBadge status={product.status} />}
            back={back}
            sticky
            action={
              <ProductActions
                product={product}
                save={<HeaderSaveActions />}
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
          {wide ? null : nav}
          <EditorLayout
            main={
              <>
                {wide ? nav : null}
                {page.layout.main.map((key) => {
                  const why = slot(key)
                  return why === undefined ? null : (
                    <PartSlot key={key} part={key} why={why}>
                      <MainPartView
                        part={key}
                        product={product}
                        data={{ state: data, slot, draws, marks }}
                      />
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
      </SectionDefaults>
    </DirtyRegistryProvider>
  )
}
