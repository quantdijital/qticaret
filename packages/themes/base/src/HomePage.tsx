import { ArrowRight } from "lucide-react"
import type { HomePageView, Translate } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { ProductGrid } from "./components/ProductCard"

const HERO_LINKS = 2

/**
 * The home page: the shop's heading and words with its first categories as
 * the way in, every top category as a tile, and the newest products. The
 * shop's own blocks (banners, rails) come with the home editor (D11).
 */
export function HomePage({ view, t }: { view: HomePageView; t: Translate }) {
  const [first, second] = view.categories.slice(0, HERO_LINKS)
  return (
    <div className="flex flex-col gap-14 lg:gap-20">
      <section className="rounded-3xl bg-muted px-6 py-12 sm:px-10 lg:px-16 lg:py-20">
        <div className="flex max-w-2xl flex-col gap-5">
          <h1 className="text-4xl font-semibold tracking-tight text-balance lg:text-5xl">
            {view.heading}
          </h1>
          {view.intro && <p className="text-lg text-muted-foreground">{view.intro}</p>}
          {first && (
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="rounded-full px-7">
                <a href={first.path}>
                  {first.label}
                  <ArrowRight aria-hidden="true" />
                </a>
              </Button>
              {second && (
                <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                  <a href={second.path}>{second.label}</a>
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
      {view.categories.length > 0 && (
        <section aria-labelledby="kategoriler" className="flex flex-col gap-6">
          <h2 id="kategoriler" className="text-2xl font-semibold tracking-tight">
            {t("home.shop_categories")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {view.categories.map((category) => (
              <li key={category.path}>
                <a
                  href={category.path}
                  className="group flex h-full min-h-24 items-end justify-between gap-3 rounded-2xl border bg-card p-5 transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{category.label}</span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="urunler" className="flex flex-col gap-6">
        <h2 id="urunler" className="text-2xl font-semibold tracking-tight">
          {t("home.products")}
        </h2>
        {view.products.length > 0 ? (
          <ProductGrid products={view.products} t={t} eager={4} />
        ) : (
          <p className="rounded-xl bg-muted py-16 text-center text-muted-foreground">
            {t("home.no_products")}
          </p>
        )}
      </section>
    </div>
  )
}
