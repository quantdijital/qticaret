import { SlidersHorizontal, X } from "lucide-react"
import type { ListingPageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"
import { Filters } from "./components/Filters"
import { Pages } from "./components/Pages"
import { ProductGrid } from "./components/ProductCard"
import { SearchHelp } from "./components/SearchHelp"
import { Sections, type Subscribe } from "./home/Sections"

/** The sort orders as links; a page's sort is never indexed (nofollow). */
function SortLinks({ view, t }: { view: ListingPageView; t: Translate }) {
  return (
    <nav aria-label={t("listing.sort")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-button border bg-card p-1">
        {view.sort.map((option) => (
          <li key={option.path}>
            <a
              href={option.path}
              aria-current={option.current ? "true" : undefined}
              rel="nofollow"
              className={cn(
                "inline-flex h-8 items-center rounded-button px-3.5 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground",
                option.current && "bg-foreground font-medium text-background hover:text-background"
              )}
            >
              {option.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * A category, brand, collection or landing page, the sale page or a
 * search's results: the heading and its subcategories (a search's help), the filters beside the grid (folded above it on phones,
 * without a script), what is chosen as removable chips, the sort, the
 * grid and the pages. The shop's sections (adr/0049) sit between the
 * heading and the grid, and below the pages.
 */
export function ListingPage({
  view,
  t,
  subscribe,
}: {
  view: ListingPageView
  t: Translate
  subscribe?: Subscribe | undefined
}) {
  const { pagination } = view
  const stock = view.stock ?? null
  const hasFilters = view.filters.length > 0 || view.price !== null || stock !== null
  const top = view.sectionsTop ?? []
  const bottom = view.sectionsBottom ?? []
  return (
    <PageContainer className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <Breadcrumbs items={view.breadcrumbs} t={t} />
        <header className="flex flex-col gap-4 border-b pb-8">
          <h1 className="text-4xl leading-tight lg:text-6xl">{view.title}</h1>
          {view.description.map((paragraph, index) => (
            <p key={String(index)} className="max-w-3xl text-lg text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {view.subcategories.length > 0 && (
            <nav
              aria-label={t("listing.subcategories")}
              className="-mx-4 overflow-x-auto px-4 pt-2"
            >
              <ul className="flex w-max gap-2 pb-1">
                {view.subcategories.map((link) => (
                  <li key={link.path}>
                    <a
                      href={link.path}
                      className="inline-flex h-10 items-center rounded-button border bg-card px-5 text-sm font-medium whitespace-nowrap transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </header>
        {view.search && <SearchHelp help={view.search} t={t} />}
      </div>

      {top.length > 0 && (
        <div className="flex flex-col gap-12 pb-4 lg:gap-16">
          <Sections sections={top} t={t} subscribe={subscribe} />
        </div>
      )}

      <div
        className={cn("grid gap-8", hasFilters && "lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12")}
      >
        {hasFilters && (
          <>
            <aside aria-label={t("listing.filters")} className="hidden lg:block">
              <div className="sticky top-40">
                <Filters filters={view.filters} price={view.price} stock={stock} t={t} />
              </div>
            </aside>
            <details className="rounded-2xl border bg-card lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-4 text-sm font-semibold marker:hidden">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                {t("listing.show_filters")}
                {view.active.length > 0 && (
                  <span className="tabular rounded-full bg-foreground px-2 py-0.5 text-[11px] text-background">
                    {view.active.length}
                  </span>
                )}
              </summary>
              <div className="border-t px-5 pt-4">
                <Filters filters={view.filters} price={view.price} stock={stock} t={t} />
              </div>
            </details>
          </>
        )}

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* The grid's heading: the cards' names (h3) sit under it, never straight under the h1 */}
            <h2 className="font-sans text-sm font-medium tracking-normal text-muted-foreground">
              {t("listing.count", { count: view.total })}
            </h2>
            <SortLinks view={view} t={t} />
          </div>

          {view.active.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" aria-label={t("listing.active")}>
              {view.active.map((chip) => (
                <a
                  key={chip.path}
                  href={chip.path}
                  rel="nofollow"
                  aria-label={t("listing.remove_filter", { label: chip.label })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-button bg-foreground pr-2.5 pl-3.5 text-xs font-medium text-background hover:opacity-90"
                >
                  {chip.label}
                  <X className="size-3.5" aria-hidden="true" />
                </a>
              ))}
              {view.clearPath && (
                <a
                  href={view.clearPath}
                  rel="nofollow"
                  className="px-2 text-xs font-semibold underline underline-offset-4"
                >
                  {t("listing.clear")}
                </a>
              )}
            </div>
          )}

          {view.products.length > 0 ? (
            <ProductGrid
              products={view.products}
              t={t}
              eager={pagination.page === 1 ? 4 : 0}
              columns={hasFilters ? 3 : 4}
            />
          ) : (
            view.description.length === 0 && (
              <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
                {view.active.length > 0
                  ? t("listing.no_match")
                  : (view.empty ?? t("listing.empty"))}
              </p>
            )
          )}
          <Pages pagination={pagination} t={t} />
        </div>
      </div>

      {bottom.length > 0 && (
        <div className="mt-12 flex flex-col gap-20 lg:mt-20 lg:gap-28">
          <Sections sections={bottom} t={t} subscribe={subscribe} />
        </div>
      )}
    </PageContainer>
  )
}
