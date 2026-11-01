import type { HomePageView, Translate } from "@qticaret/ui"
import { ProductGrid } from "./components/ProductCard"

export function HomePage({ view, t }: { view: HomePageView; t: Translate }) {
  return (
    <div className="flex flex-col gap-10">
      {view.heading && <h1 className="text-2xl font-semibold sm:text-3xl">{view.heading}</h1>}
      {view.categories.length > 0 && (
        <section aria-labelledby="kategoriler">
          <h2 id="kategoriler" className="mb-3 text-lg font-semibold">
            {t("home.categories")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {view.categories.map((category) => (
              <li key={category.path}>
                <a
                  href={category.path}
                  className="inline-block rounded-full border border-line px-4 py-2 text-sm hover:bg-subtle"
                >
                  {category.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="urunler">
        <h2 id="urunler" className="mb-4 text-lg font-semibold">
          {t("home.products")}
        </h2>
        {view.products.length > 0 ? (
          <ProductGrid products={view.products} t={t} eager={2} />
        ) : (
          <p className="text-muted">{t("home.no_products")}</p>
        )}
      </section>
    </div>
  )
}
