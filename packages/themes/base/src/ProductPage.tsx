import type { ProductPageView, ThemeActions, Translate } from "@qticaret/ui"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { ProductDetails, SpecHighlights } from "./components/ProductDetails"
import { ProductGallery } from "./components/ProductGallery"
import { PurchasePanel } from "./components/PurchasePanel"

const ACTION_ERRORS = [
  "cart.add_failed",
  "cart.variant_unavailable",
  "cart.quantity_invalid",
  "errors.too_many_requests",
]

/**
 * A product: its pictures, then its name, price, options and the cart
 * form (sticky beside the pictures on wide screens), then its description
 * and attributes, open in the HTML for shoppers, crawlers and agents alike.
 */
export function ProductPage({
  view,
  t,
  actions,
}: {
  view: ProductPageView
  t: Translate
  actions: ThemeActions
}) {
  const discounts = new Set(
    view.variants.flatMap((variant) =>
      typeof variant.price?.discount === "number" ? [variant.price.discount] : []
    )
  )
  return (
    <article className="flex flex-col gap-8">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <ProductGallery
          images={view.images}
          label={t("product.images")}
          noImage={t("product.no_image")}
        />
        <div className="flex flex-col gap-6 lg:sticky lg:top-36 lg:self-start">
          <header className="flex flex-col gap-2">
            {view.brand && (
              <a
                href={view.brand.path}
                className="text-sm font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
              >
                {view.brand.label}
              </a>
            )}
            <h1 className="text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
              {view.title}
            </h1>
            {view.subtitle && <p className="text-muted-foreground">{view.subtitle}</p>}
          </header>
          <SpecHighlights specs={view.specs} label={t("product.highlights")} />
          <PurchasePanel
            options={view.options}
            variants={view.variants}
            selectedVariantId={view.selectedVariantId}
            addToCart={actions.addToCart}
            labels={{
              quantity: t("product.quantity"),
              decrease: t("product.decrease"),
              increase: t("product.increase"),
              add: t("product.add_to_cart"),
              adding: t("product.adding"),
              added: t("product.added"),
              goToCart: t("product.go_to_cart"),
              inStock: t("product.in_stock"),
              outOfStock: t("product.out_of_stock"),
              chooseOptions: t("product.choose_options"),
              discount: Object.fromEntries(
                [...discounts].map((percent) => [percent, t("product.discount", { percent })])
              ),
              errors: Object.fromEntries(ACTION_ERRORS.map((key) => [key, t(key)])),
              fallbackError: t("cart.add_failed"),
              before: t("price.before"),
            }}
          />
        </div>
      </div>
      <ProductDetails description={view.description} specs={view.specs} t={t} />
    </article>
  )
}
