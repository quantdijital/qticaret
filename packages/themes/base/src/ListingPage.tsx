import type { ListingPageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { ProductGrid } from "./components/ProductCard"

/** A category, brand, collection or landing page: real links for sorting and pages. */
export function ListingPage({ view, t }: { view: ListingPageView; t: Translate }) {
  const { pagination } = view
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{view.title}</h1>
        {view.description.map((paragraph, index) => (
          <p key={String(index)} className="max-w-3xl text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </header>
      {view.subcategories.length > 0 && (
        <nav aria-label={t("listing.subcategories")}>
          <ul className="flex flex-wrap gap-2">
            {view.subcategories.map((link) => (
              <li key={link.path}>
                <a
                  href={link.path}
                  className="inline-block rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 text-sm">
        <p className="text-muted-foreground">{t("listing.count", { count: view.total })}</p>
        <nav aria-label={t("listing.sort")}>
          <ul className="flex flex-wrap gap-3">
            {view.sort.map((option) => (
              <li key={option.path}>
                <a
                  href={option.path}
                  aria-current={option.current ? "true" : undefined}
                  className={cn("hover:underline", option.current && "font-semibold underline")}
                  rel="nofollow"
                >
                  {option.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {view.products.length > 0 ? (
        <ProductGrid products={view.products} t={t} eager={pagination.page === 1 ? 2 : 0} />
      ) : (
        <p className="py-10 text-center text-muted-foreground">{t("listing.empty")}</p>
      )}
      {pagination.pages > 1 && (
        <nav
          aria-label={t("listing.pages")}
          className="flex items-center justify-center gap-2 text-sm"
        >
          {pagination.previous && (
            <a
              href={pagination.previous}
              className="rounded-full border border-border px-4 py-2 hover:bg-muted"
            >
              {t("listing.previous")}
            </a>
          )}
          <span className="px-2 text-muted-foreground">
            {t("listing.page_of", { page: pagination.page, pages: pagination.pages })}
          </span>
          {pagination.next && (
            <a
              href={pagination.next}
              className="rounded-full border border-border px-4 py-2 hover:bg-muted"
            >
              {t("listing.next")}
            </a>
          )}
        </nav>
      )}
    </div>
  )
}
