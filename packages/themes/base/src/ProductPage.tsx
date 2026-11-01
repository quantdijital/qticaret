import type { ProductPageView, ThemeActions, Translate } from "@qticaret/ui"
import { MessageCircle } from "lucide-react"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"
import { FavoriteButton } from "./components/FavoriteButton"
import { ProductGrid } from "./components/ProductCard"
import { ProductCommunity } from "./components/ProductCommunity"
import { ProductDetails, SpecHighlights } from "./components/ProductDetails"
import { ProductGallery } from "./components/ProductGallery"
import { PurchasePanel } from "./components/PurchasePanel"
import { TrustStrip } from "./components/TrustStrip"

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
    <PageContainer>
      <article className="flex flex-col gap-8 lg:gap-12">
        <Breadcrumbs items={view.breadcrumbs} t={t} />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <ProductGallery
            images={view.images}
            label={t("product.images")}
            noImage={t("product.no_image")}
            initial={view.title.trim().charAt(0).toLocaleUpperCase("tr")}
          />
          <div className="flex flex-col gap-6 lg:sticky lg:top-40 lg:self-start">
            <header className="flex flex-col gap-3">
              {view.brand && (
                <a
                  href={view.brand.path}
                  className="text-xs font-semibold tracking-[0.14em] text-primary uppercase hover:underline"
                >
                  {view.brand.label}
                </a>
              )}
              <h1 className="text-4xl leading-[1.08] text-balance lg:text-5xl">{view.title}</h1>
              {view.subtitle && <p className="text-lg text-muted-foreground">{view.subtitle}</p>}
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
                saving: t("product.saving"),
              }}
              stockAlert={actions.stockAlert}
              installments={actions.installments}
              installmentWords={{
                title: t("product.installments"),
                loading: t("product.installments_loading"),
                none: t("product.installments_none"),
                count: t("product.installments_count"),
                per: t("product.installments_per"),
                total: t("product.installments_total"),
                single: t("product.installments_single"),
              }}
              signedIn={view.signedIn}
              alertWords={{
                title: t("product.alert_title"),
                email: t("checkout.email"),
                submit: t("product.alert_submit"),
                sent: t("product.alert_sent"),
                sentGuest: t("product.alert_sent_guest"),
                errors: Object.fromEntries(
                  [
                    "stock_alerts.in_stock",
                    "stock_alerts.not_tracked",
                    "checkout.email_invalid",
                    "errors.too_many_requests",
                    "errors.challenge_failed",
                  ].map((key) => [key, t(key)])
                ),
                fallback: t("product.alert_failed"),
              }}
            />
            <FavoriteButton
              productId={view.id}
              signedIn={view.signedIn}
              loginPath={view.loginPath}
              add={actions.addFavorite}
              words={{
                add: t("product.favorite_add"),
                added: t("product.favorite_added"),
                errors: Object.fromEntries(
                  ["product.sign_in_first", "wishlist.full"].map((key) => [key, t(key)])
                ),
                fallback: t("product.favorite_failed"),
              }}
            />
            {view.whatsappHref && (
              <a
                href={view.whatsappHref}
                target="_blank"
                rel="noopener"
                className="flex h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold hover:bg-foreground/5"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                {t("product.ask_whatsapp")}
              </a>
            )}
            {view.shippingNote && (
              <p className="text-sm text-muted-foreground">{view.shippingNote}</p>
            )}
            <TrustStrip badges={view.trustBadges} label={t("footer.trust")} compact />
          </div>
        </div>
        <ProductDetails description={view.description} specs={view.specs} t={t} />
        <ProductCommunity
          productId={view.id}
          reviews={view.reviews}
          questions={view.questions}
          signedIn={view.signedIn}
          loginPath={view.loginPath}
          writeReview={actions.writeReview}
          askQuestion={actions.askQuestion}
          words={{
            reviews: t("product.reviews"),
            noReviews: t("product.no_reviews"),
            writeReview: t("product.write_review"),
            rating: t("product.rating"),
            reviewTitle: t("product.review_title"),
            reviewBody: t("product.review_body"),
            send: t("product.send"),
            sending: t("checkout.saving"),
            reviewSent: t("product.review_sent"),
            verified: t("product.verified"),
            questions: t("product.questions"),
            noQuestions: t("product.no_questions"),
            ask: t("product.ask"),
            questionBody: t("product.question_body"),
            questionSent: t("product.question_sent"),
            signIn: t("account.login_link"),
            signInToWrite: t("product.sign_in_to_write"),
            average: t("product.average"),
            errors: Object.fromEntries(
              [
                "product.sign_in_first",
                "product.rating_required",
                "product.review_too_short",
                "product.question_too_short",
                "reviews.not_purchased",
                "reviews.already_reviewed",
                "errors.too_many_requests",
              ].map((key) => [key, t(key)])
            ),
            fallback: t("product.review_failed"),
          }}
        />
        {view.related.length > 0 && (
          <section aria-labelledby="benzer" className="flex flex-col gap-6 border-t pt-10">
            <h2 id="benzer" className="text-2xl">
              {t("product.related")}
            </h2>
            <ProductGrid products={view.related} t={t} />
          </section>
        )}
      </article>
    </PageContainer>
  )
}
