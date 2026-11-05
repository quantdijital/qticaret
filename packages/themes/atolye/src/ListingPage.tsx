import type { FormAction, ListingPageView, Translate } from "@qticaret/ui"
import { TileRail } from "./listing/CategoryTiles"
import { FilterPanel, hasFilters } from "./listing/FilterPanel"
import { FilterSheet } from "./listing/FilterSheet"
import { Pager } from "./listing/Pager"
import { Empty, SearchHelp } from "./listing/SearchHelp"
import { Toolbar } from "./listing/Toolbar"
import { Container } from "./parts/Container"
import { ProductGrid } from "./parts/ProductCard"
import { Trail } from "./parts/Trail"
import { Blocks, type Subscribe } from "./sections/Blocks"

/** The phone's filter sheet and the grid's head, by id. */
const SHEET = "filtreler"
const RESULTS = "sonuclar"

/**
 * A category, brand, collection or landing page, `/magaza`, the sale
 * page or a site search (docs/tema/yon-2026-11-05.md, Grafit): the trail,
 * the heavy title with the shop's short intro beside it, the
 * subcategories (or a search's related categories) as one row of picture
 * tiles, then the list: from 1024 px the filters in filled wells on the
 * left, on a phone in a sheet from the bottom; the count and the sort
 * over the grid, the filters on as dark pills; the home page's cards, the
 * pages under them. An empty list says why and offers a way on. The
 * shop's category page sections (adr/0049) sit above the list and below it.
 */
export function ListingPage({
  view,
  t,
  subscribe,
  quickAdd,
}: {
  view: ListingPageView
  t: Translate
  subscribe?: Subscribe | undefined
  quickAdd?: FormAction | undefined
}) {
  const filters = hasFilters(view)
  const search = view.search !== undefined
  const help = view.search ?? null
  const found = view.products.length > 0
  const listed = view.total > 0 || view.active.length > 0
  const panel = filters && listed
  const top = view.sectionsTop ?? []
  const bottom = view.sectionsBottom ?? []
  return (
    <>
      <Container className="pt-4 lg:pt-6">
        <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} />
        <header className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-12 lg:items-end lg:gap-(--gap-columns)">
          <h1 className="lg:col-span-7">{view.title}</h1>
          {!search && view.description.length > 0 && (
            <div className="flex flex-col gap-3 text-md text-text-2 lg:col-span-5 lg:pb-2 lg:text-lead">
              {view.description.map((paragraph, index) => (
                <p key={String(index)}>{paragraph}</p>
              ))}
            </div>
          )}
        </header>
        <div className="mt-6 flex flex-col gap-8 empty:hidden lg:mt-8">
          {search && found && help && <SearchHelp help={help} t={t} />}
          {!search && (
            <TileRail
              id="alt-kategoriler"
              title={t("listing.subcategories")}
              categories={view.subcategories}
            />
          )}
        </div>
      </Container>

      {top.length > 0 && <Blocks sections={top} t={t} subscribe={subscribe} quickAdd={quickAdd} />}

      <Container className="pt-8 lg:pt-(--space-xl)">
        {listed ? (
          <div
            className={
              panel
                ? "grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-(--space-xl)"
                : "grid gap-8"
            }
          >
            {panel && (
              <aside aria-labelledby="filtre-baslik" className="max-lg:hidden">
                <div className="sticky top-40 flex max-h-[calc(100dvh-11rem)] flex-col gap-3 overflow-y-auto overscroll-contain pb-2">
                  <h2 id="filtre-baslik" className="text-title">
                    {t("listing.filters")}
                  </h2>
                  <FilterPanel view={view} t={t} id="filtre-yan" />
                </div>
              </aside>
            )}
            <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
              <Toolbar view={view} t={t} sheet={panel ? SHEET : null} results={RESULTS} />
              {found ? (
                <ProductGrid
                  products={view.products}
                  t={t}
                  quickAdd={quickAdd}
                  wide={!filters}
                  beside={filters}
                  eager={view.pagination.page === 1 ? 2 : 0}
                />
              ) : (
                <Empty view={view} t={t} />
              )}
              <div className="pt-4">
                <Pager pagination={view.pagination} t={t} />
              </div>
            </div>
          </div>
        ) : (
          <Empty view={view} t={t} />
        )}
        {panel && (
          <FilterSheet
            id={SHEET}
            title={t("listing.filters")}
            close={t("listing.close_filters")}
            showResults={t("listing.show_results", { count: view.total })}
            results={RESULTS}
            clear={
              view.clearPath ? { label: t("listing.clear_short"), path: view.clearPath } : null
            }
          >
            <FilterPanel view={view} t={t} id="filtre-sayfa" hash={SHEET} />
          </FilterSheet>
        )}
      </Container>

      {bottom.length > 0 && (
        <Blocks sections={bottom} t={t} subscribe={subscribe} quickAdd={quickAdd} />
      )}
    </>
  )
}
