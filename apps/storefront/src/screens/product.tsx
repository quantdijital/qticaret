import type { Resolution } from "@qticaret/types"
import { formatLira } from "@qticaret/ui"
import { themeActions } from "@/lib/theme-actions"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import { pathsOf, priceDisplays, productById, storefrontSettings } from "@/lib/store-api/requests"
import { currentCustomer } from "@/lib/account/auth"
import { storefrontEnv } from "@/lib/env"
import { whatsappHref } from "@/lib/views/frame"
import { productPage, variantIdsOf } from "@/lib/views/product"
import { questionsView, relatedOf, reviewsView } from "@/lib/views/product-extras"
import { swatchLookup } from "@/lib/views/color"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

/** A product page: the product with live prices, its brand's link and `?variant=` chosen. */
export async function ProductScreen({ page, url }: { page: Entity; url: URL }) {
  const product = await productById(page.entity_id)
  const [
    displays,
    brandPaths,
    { storefront, free_shipping_threshold },
    reviews,
    questions,
    related,
    customer,
  ] = await Promise.all([
    priceDisplays(variantIdsOf([product])),
    product.brand
      ? pathsOf("brand", [product.brand.id])
      : Promise.resolve({} as Record<string, string>),
    storefrontSettings(),
    reviewsView(product.id, t),
    questionsView(product.id, t),
    relatedOf(product),
    currentCustomer(),
  ])
  const here = `${url.pathname}${url.search}`
  const amounts = (product.variants ?? []).flatMap((variant) => {
    const amount = variant.calculated_price?.calculated_amount
    return typeof amount === "number" ? [amount] : []
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
  })
  const view = {
    ...base,
    reviews,
    questions,
    related,
    signedIn: customer !== null,
    shippingNote:
      free_shipping_threshold && free_shipping_threshold > 0
        ? t("product.free_shipping_from", { amount: formatLira(free_shipping_threshold) })
        : null,
    loginPath: `/hesap/giris?sonra=${encodeURIComponent(here)}`,
    whatsappHref: storefront.whatsapp_phone
      ? `${whatsappHref(storefront.whatsapp_phone)}?text=${encodeURIComponent(
          t("product.whatsapp_text", {
            title: product.title,
            url: `${storefrontEnv().STOREFRONT_ORIGIN}${url.pathname}`,
          })
        )}`
      : null,
  }
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      {/* Open Graph's product type and price (React puts these in <head>) */}
      <meta property="og:type" content="product" />
      {lowest !== null && (
        <>
          <meta property="product:price:amount" content={lowest.toFixed(2)} />
          <meta property="product:price:currency" content="TRY" />
        </>
      )}
      <theme.ProductPage view={view} t={t} actions={themeActions} />
    </>
  )
}
