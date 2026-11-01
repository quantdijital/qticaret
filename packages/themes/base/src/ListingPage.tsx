import type { ListingPageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { Pages } from "./components/Pages"
import { ProductGrid } from "./components/ProductCard"

/**
 * A category, brand, collection, landing page or search: the heading, the
 * subcategories as chips, the count and sort (real links), the grid and
 * the pages.
 */
export function ListingPage({ view, t }: { view: ListingPageView; t: Translate }) {
  const { pagination } = view
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">{view.title}</h1>
        {view.description.map((paragraph, index) => (
          <p key={String(index)} className="max-w-3xl text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </header>
      {view.subcategories.length > 0 && (
        <nav aria-label={t("listing.subcategories")} className="-mx-4 overflow-x-auto px-4">
          <ul className="flex w-max gap-2 pb-1">
            {view.subcategories.map((link) => (
              <li key={link.path}>
                <a
                  href={link.path}
                  className="inline-flex h-9 items-center rounded-full border bg-background px-4 text-sm font-medium whitespace-nowrap hover:bg-accent"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {(view.total > 0 || view.sort.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3 text-sm">
          <p className="text-muted-foreground">{t("listing.count", { count: view.total })}</p>
          {view.sort.length > 0 && (
            <nav aria-label={t("listing.sort")}>
              <ul className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
                {view.sort.map((option) => (
                  <li key={option.path}>
                    <a
                      href={option.path}
                      aria-current={option.current ? "true" : undefined}
                      rel="nofollow"
                      className={cn(
                        "inline-flex h-8 items-center rounded-full px-3.5 text-muted-foreground hover:text-foreground",
                        option.current && "bg-background font-medium text-foreground shadow-sm"
                      )}
                    >
                      {option.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      )}
      {view.products.length > 0 ? (
        <ProductGrid products={view.products} t={t} eager={pagination.page === 1 ? 4 : 0} />
      ) : (
        view.description.length === 0 && (
          <p className="rounded-xl bg-muted py-16 text-center text-muted-foreground">
            {t("listing.empty")}
          </p>
        )
      )}
      <Pages pagination={pagination} t={t} />
    </div>
  )
}
