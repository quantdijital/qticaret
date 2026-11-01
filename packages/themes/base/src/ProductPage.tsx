import { ResponsiveImage } from "@qticaret/ui"
import type { ProductPageView, ThemeActions, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PurchasePanel } from "./components/PurchasePanel"

const ACTION_ERRORS = [
  "cart.add_failed",
  "cart.variant_unavailable",
  "cart.quantity_invalid",
  "errors.too_many_requests",
]

export function ProductPage({
  view,
  t,
  actions,
}: {
  view: ProductPageView
  t: Translate
  actions: ThemeActions
}) {
  const [main, ...rest] = view.images
  return (
    <article className="flex flex-col gap-6">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <div className="grid gap-8 md:grid-cols-2">
        <section aria-label={t("product.images")} className="flex flex-col gap-3">
          {main ? (
            <div className="overflow-hidden rounded-xl bg-muted">
              <ResponsiveImage
                image={main}
                sizes="(min-width: 768px) 50vw, 100vw"
                priority
                className="h-auto w-full"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl bg-muted text-muted-foreground">
              {t("product.no_image")}
            </div>
          )}
          {rest.length > 0 && (
            <ul className="grid grid-cols-4 gap-2">
              {rest.map((image) => (
                <li key={image.src} className="overflow-hidden rounded-lg bg-muted">
                  <ResponsiveImage
                    image={image}
                    sizes="(min-width: 768px) 12vw, 25vw"
                    className="h-full w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-5">
          {view.brand && (
            <a
              href={view.brand.path}
              className="text-sm uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {view.brand.label}
            </a>
          )}
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{view.title}</h1>
            {view.subtitle && <p className="mt-1 text-muted-foreground">{view.subtitle}</p>}
          </div>
          <PurchasePanel
            options={view.options}
            variants={view.variants}
            selectedVariantId={view.selectedVariantId}
            addToCart={actions.addToCart}
            labels={{
              quantity: t("product.quantity"),
              add: t("product.add_to_cart"),
              adding: t("product.adding"),
              added: t("product.added"),
              outOfStock: t("product.out_of_stock"),
              chooseOptions: t("product.choose_options"),
              errors: Object.fromEntries(ACTION_ERRORS.map((key) => [key, t(key)])),
              fallbackError: t("cart.add_failed"),
              before: t("price.before"),
            }}
          />
          {view.description.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border pt-5 text-sm leading-relaxed">
              <h2 className="text-base font-semibold">{t("product.description")}</h2>
              {view.description.map((paragraph, index) => (
                <p key={String(index)}>{paragraph}</p>
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  )
}
