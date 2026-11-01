import type { Resolution } from "@qticaret/types"
import { themeActions } from "@/lib/theme-actions"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import { pathsOf, priceDisplays, productById, storefrontSettings } from "@/lib/store-api/requests"
import { currentCustomer } from "@/lib/account/auth"
import { storefrontEnv } from "@/lib/env"
import { whatsappHref } from "@/lib/views/frame"
import { productPage, variantIdsOf } from "@/lib/views/product"
import { questionsView, relatedOf, reviewsView } from "@/lib/views/product-extras"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

/** A product page: the product with live prices, its brand's link and `?variant=` chosen. */
export async function ProductScreen({ page, url }: { page: Entity; url: URL }) {
  const product = await productById(page.entity_id)
  const [displays, brandPaths, { storefront }, reviews, questions, related, customer] =
    await Promise.all([
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
  const base = productPage({
    product,
    seo: page.seo,
    displays,
    brandPath: product.brand ? (brandPaths[product.brand.id] ?? null) : null,
    requestedVariant: url.searchParams.get("variant"),
    t,
    trustBadges: storefront.trust_badges,
  })
  const view = {
    ...base,
    reviews,
    questions,
    related,
    signedIn: customer !== null,
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
      <theme.ProductPage view={view} t={t} actions={themeActions} />
    </>
  )
}
