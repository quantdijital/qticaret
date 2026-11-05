import type { Resolution } from "@qticaret/types"
import { formatLira } from "@qticaret/ui"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { themeActions } from "@/lib/theme-actions"
import { t } from "@/lib/i18n"
import { productEvents } from "@/lib/analytics/payloads"
import { TrackEvents } from "@/lib/analytics/TrackEvents"
import { faqJsonLd } from "@/lib/seo/faq"
import { JsonLd } from "@/lib/seo/JsonLd"
import {
  legalIdentity,
  pathsOf,
  priceDisplays,
  productById,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { currentCustomer } from "@/lib/account/auth"
import { productAddonsOrNone } from "@/lib/cart/addons"
import { productDescriptionHtml } from "@/lib/store-api/product-description"
import { storefrontEnv } from "@/lib/env"
import { whatsappHref } from "@/lib/views/frame"
import { currentLayout } from "@/lib/views/layout"
import { addonFieldsOf } from "@/lib/views/addons"
import { shownAmount } from "@/lib/views/price"
import { productPage, variantIdsOf } from "@/lib/views/product"
import { questionsView, relatedOf, reviewsView } from "@/lib/views/product-extras"
import { swatchLookup } from "@/lib/views/color"
import { sectionViews, showsOwnCategory } from "@/lib/views/sections"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

/**
 * A product page: the product with live prices, its brand's link and
 * `?variant=` chosen, and the sections the shop put below every product
 * (adr/0049). The shop's own rail of the product's category takes the
 * place of the storefront's fixed "similar products".
 */
export async function ProductScreen({ page, url }: { page: Entity; url: URL }) {
  // The description's document as the backend renders it (adr/0055): asked beside the product
  const [product, layout, descriptionHtml] = await Promise.all([
    productById(page.entity_id),
    currentLayout(),
    productDescriptionHtml(page.entity_id),
  ])
  const ownRail = showsOwnCategory(layout.product)
  const [
    displays,
    brandPaths,
    { storefront, free_shipping_threshold, features },
    reviews,
    questions,
    related,
    customer,
    sections,
    addons,
  ] = await Promise.all([
    priceDisplays(variantIdsOf([product])),
    product.brand
      ? pathsOf("brand", [product.brand.id])
      : Promise.resolve({} as Record<string, string>),
    storefrontSettings(),
    reviewsView(product.id, t),
    questionsView(product.id, t),
    ownRail ? Promise.resolve([]) : relatedOf(product),
    currentCustomer(),
    sectionViews(layout.product, t, {
      product: {
        id: product.id,
        categoryIds: (product.categories ?? []).map((category) => category.id),
      },
    }),
    // A gift card takes no add-ons; none while the shop has them off (`features`: not asked then)
    product.product_extension?.is_gift_card ? Promise.resolve([]) : productAddonsOrNone(product.id),
  ])
  // The shop's WhatsApp number comes with its contact details (adr/0048)
  const { whatsapp } = await legalIdentity()
  const here = `${url.pathname}${url.search}`
  // What the shopper pays, an automatic promotion included (adr/0023 Ek 2026-11-05)
  const amounts = (product.variants ?? []).flatMap((variant) => {
    const amount = shownAmount(variant, displays)
    return amount === null ? [] : [amount]
  })
  const lowest = amounts.length > 0 ? Math.min(...amounts) : null
  const base = productPage({
    product,
    seo: page.seo,
    displays,
    brandPath: product.brand ? (brandPaths[product.brand.id] ?? null) : null,
    requestedVariant: url.searchParams.get("variant"),
    t,
    trustBadges: storefront.trust_badges,
    swatchOf: swatchLookup(storefront.color_swatches),
    descriptionHtml,
  })
  const view = {
    ...base,
    reviews,
    questions,
    related,
    sections,
    // The amount is the variant; the cart form asks who the card is for (adr/0025 Ek 2026-11-03)
    giftCard: features?.gift_cards === true && product.product_extension?.is_gift_card === true,
    // Picked above "add to cart"; the server prices them on the line (adr/0052)
    addons: addonFieldsOf(addons, t),
    signedIn: customer !== null,
    shippingNote:
      free_shipping_threshold && free_shipping_threshold > 0
        ? t("product.free_shipping_from", { amount: formatLira(free_shipping_threshold) })
        : null,
    loginPath: `/hesap/giris?sonra=${encodeURIComponent(here)}`,
    whatsappHref: whatsapp
      ? `${whatsappHref(whatsapp)}?text=${encodeURIComponent(
          t("product.whatsapp_text", {
            title: product.title,
            url: `${storefrontEnv().STOREFRONT_ORIGIN}${url.pathname}`,
          })
        )}`
      : null,
  }
  // The price the page shows, an automatic promotion included, is the one measured
  const measured = productEvents(product, base.selectedVariantId, displays)
  return (
    <>
      <TrackEvents events={measured.events} context={measured.context} />
      <JsonLd blocks={[...(page.seo?.jsonLd ?? []), ...faqJsonLd(sections)]} />
      {/* Open Graph's product type and price (React puts these in <head>) */}
      <meta property="og:type" content="product" />
      {lowest !== null && (
        <>
          <meta property="product:price:amount" content={lowest.toFixed(2)} />
          <meta property="product:price:currency" content="TRY" />
        </>
      )}
      <theme.ProductPage view={view} t={t} actions={themeActions} subscribe={subscribeNewsletter} />
    </>
  )
}
