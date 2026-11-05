import { Info } from "lucide-react"
import type { ProductPageView, ThemeActions, Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"
import { ProductGrid } from "./parts/ProductCard"
import { Trail } from "./parts/Trail"
import { Buy } from "./product/Buy"
import { Community } from "./product/Community"
import { Details } from "./product/Details"
import { Gallery } from "./product/Gallery"
import { Delivery, Headline } from "./product/Headline"
import {
  addonWords,
  alertWords,
  buyWords,
  favoriteWords,
  galleryWords,
  giftWords,
  installmentWords,
} from "./product/words"
import { Blocks, type Subscribe } from "./sections/Blocks"
import { SectionHead } from "./sections/SectionHead"

/**
 * A product (docs/tema/yon-2026-11-05.md, Grafit; sahip 2026-11-05): the
 * trail, then the photographs (from 1024 px five columns, a square in a
 * soft well with its thumbnails under it, both staying in view) beside
 * the buy column: the name and its stars, the price, the options and
 * add-ons, "add to cart" with the favourite heart, the instalments, the
 * legal note before the purchase and the delivery facts. Right below:
 * the description and the ruled spec table as two tabs, then the reviews
 * at once, the questions, the category's other products, and the
 * sections the shop put under every product (adr/0049). On a phone a buy
 * bar takes the bottom once the button has scrolled away.
 */
export function ProductPage({
  view,
  t,
  actions,
  subscribe,
}: {
  view: ProductPageView
  t: Translate
  actions: ThemeActions
  subscribe?: Subscribe | undefined
}) {
  const sections = view.sections ?? []
  const percents = [
    ...new Set(
      view.variants.flatMap((variant) =>
        typeof variant.price?.discount === "number" ? [variant.price.discount] : []
      )
    ),
  ]
  const gift = view.giftCard && actions.addGiftToCart ? actions.addGiftToCart : null
  const addons =
    !view.giftCard && view.addons && view.addons.length > 0 && actions.addAddonsToCart
      ? { action: actions.addAddonsToCart, fields: view.addons, words: addonWords(t) }
      : null
  return (
    <>
      <Container className="pt-4 lg:pt-6">
        <Trail items={view.breadcrumbs} label={t("nav.breadcrumbs")} compact />
      </Container>
      <Container className="mt-4 grid gap-8 lg:mt-6 lg:grid-cols-12 lg:gap-(--gap-columns)">
        <div className="min-w-0 lg:col-span-5">
          <div className="lg:sticky lg:top-40">
            <Gallery
              images={view.images}
              initial={view.title.trim().charAt(0).toLocaleUpperCase("tr")}
              words={galleryWords(t)}
            />
          </div>
        </div>
        <div className="min-w-0 lg:col-span-7 lg:pl-(--space-lg)">
          <div className="flex flex-col gap-6 lg:sticky lg:top-40">
            <Headline view={view} t={t} />
            <Buy
              productId={view.id}
              title={view.title}
              image={view.images[0] ?? null}
              options={view.options}
              variants={view.variants}
              selectedVariantId={view.selectedVariantId}
              addToCart={actions.addToCart}
              gift={gift ? { action: gift, words: giftWords(t) } : null}
              addons={addons}
              favorite={{
                add: actions.addFavorite,
                loginPath: view.loginPath,
                words: favoriteWords(t),
              }}
              installments={{ load: actions.installments, words: installmentWords(t) }}
              stockAlert={{ action: actions.stockAlert, words: alertWords(t) }}
              signedIn={view.signedIn}
              words={buyWords(t, percents)}
            />
            {/* Before the purchase, beside the buy form (MSY md. 5/1-h, 6/2): the storefront's words */}
            {view.withdrawalNote && (
              <p className="flex items-start gap-3 rounded-media bg-paper-2 p-4 text-sm font-semibold">
                <Info className="size-5 shrink-0" aria-hidden="true" strokeWidth={2} />
                {view.withdrawalNote}
              </p>
            )}
            <Delivery view={view} t={t} />
          </div>
        </div>
      </Container>

      <Container className="flex flex-col gap-(--section-gap-s) pt-(--section-gap-s)">
        <Details view={view} t={t} />
        <Community view={view} t={t} actions={actions} />
        {view.related.length > 0 && (
          <section aria-labelledby="benzer-urunler" className="flex flex-col gap-6 lg:gap-10">
            <SectionHead id="benzer-urunler" title={t("product.related")} />
            <ProductGrid
              products={view.related.slice(0, 8)}
              t={t}
              quickAdd={actions.addToCart}
              wide
            />
          </section>
        )}
      </Container>

      {sections.length > 0 && (
        <Blocks sections={sections} t={t} subscribe={subscribe} quickAdd={actions.addToCart} />
      )}
    </>
  )
}
