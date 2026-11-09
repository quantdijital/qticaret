import type { ProductPageView, Translate, TrustBadgeView } from "@qticaret/ui"
import type { StoreProduct } from "@qticaret/types"
import { productPage } from "./product"

/** A draft product's signed preview link (F18): `/onizleme/prod_….<end>.<mac>`. */
export const PRODUCT_PREVIEW_TOKEN = /^prod_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43}$/

export const isProductPreviewToken = (token: string): boolean => PRODUCT_PREVIEW_TOKEN.test(token)

export interface ProductPreviewInput {
  product: StoreProduct
  /** Its descriptions' HTML as the backend rendered them; null: none. */
  descriptionHtml: string | null
  summaryHtml: string | null
  /** `?variant=` from the address. */
  requestedVariant: string | null
  trustBadges: TrustBadgeView[]
  swatchOf?: (value: string) => string | null
  t: Translate
}

/**
 * A draft product's page as it will read once published (F18): the
 * product's own block as the live page draws it, said to be a preview,
 * without what only a live product has (reviews, questions, neighbours,
 * the shop's sections, a WhatsApp link, the shipping card). Its price is
 * Medusa's for the lira region; the 30-day display needs a live product.
 */
export function productPreviewView({
  product,
  descriptionHtml,
  summaryHtml,
  requestedVariant,
  trustBadges,
  swatchOf,
  t,
}: ProductPreviewInput): ProductPageView {
  const base = productPage({
    product,
    seo: null,
    displays: {},
    brandPath: null,
    requestedVariant,
    t,
    trustBadges,
    ...(swatchOf ? { swatchOf } : {}),
    descriptionHtml,
    summaryHtml,
  })
  return {
    ...base,
    reviews: { average: null, count: 0, items: [] },
    questions: { count: 0, items: [] },
    related: [],
    sections: [],
    whatsappHref: null,
    signedIn: false,
    loginPath: "/hesap/giris",
    shippingNote: null,
    notice: t("preview.product_notice"),
  }
}
