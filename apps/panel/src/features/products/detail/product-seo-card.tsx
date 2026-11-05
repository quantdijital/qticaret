import { useTranslation } from "react-i18next"
import { findingsNote } from "@/features/content/section-findings"
import type { SectionFindings } from "@/features/content/section-findings"
import type { ProductDetail } from "@/features/products/api/products"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { SeoCard } from "@/features/seo/components/seo-card"
import { DESCRIPTION_EXCERPT, SHORT_EXCERPT, excerpt, priceSentence } from "@/features/seo/seo-text"
import { PRODUCT_SECTIONS } from "./sections"

/**
 * The product's SEO fields, previewed with what the storefront fills the
 * templates with (adr/0015): its name, category, short text and prices.
 * With `fold`, folded under the page's main parts to the fields' lengths.
 */
export function ProductSeoCard({
  product,
  fold,
}: {
  product: ProductDetail
  /** The advisor's findings for it: folded, counted in its line, an urgent one opens it. */
  fold?: SectionFindings
}) {
  const { t } = useTranslation()
  const prefix = useProductPathPrefix()
  const subtitle = product.subtitle?.trim() ?? ""
  const liras = (product.variants ?? []).flatMap((variant) =>
    (variant.prices ?? []).flatMap((price) =>
      price.currency_code.toLowerCase() === "try" ? [price.amount] : []
    )
  )
  return (
    <SeoCard
      type="product"
      id={product.id}
      context={{
        path: `${prefix}${product.handle}`,
        tokens: {
          ürün_adı: product.title,
          kategori: product.categories?.[0]?.name ?? "",
          kısa_açıklama: subtitle !== "" ? subtitle : excerpt(product.description, SHORT_EXCERPT),
          fiyat_cümlesi: priceSentence(liras),
        },
        fallbackDescription: excerpt(product.description, DESCRIPTION_EXCERPT),
      }}
      {...(fold
        ? {
            collapse: {
              id: PRODUCT_SECTIONS.seo,
              name: "product.seo",
              note: findingsNote(t, fold),
              attention: fold.attention,
            },
          }
        : {})}
    />
  )
}
