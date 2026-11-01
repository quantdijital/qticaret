import type { Resolution } from "@qticaret/types"
import { addToCart, changeCartLine } from "@/app/actions/cart"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import { pathsOf, priceDisplays, productById } from "@/lib/store-api/requests"
import { productPage, variantIdsOf } from "@/lib/views/product"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

/** A product page: the product with live prices, its brand's link and `?variant=` chosen. */
export async function ProductScreen({ page, url }: { page: Entity; url: URL }) {
  const product = await productById(page.entity_id)
  const [displays, brandPaths] = await Promise.all([
    priceDisplays(variantIdsOf([product])),
    product.brand
      ? pathsOf("brand", [product.brand.id])
      : Promise.resolve({} as Record<string, string>),
  ])
  const view = productPage({
    product,
    seo: page.seo,
    displays,
    brandPath: product.brand ? (brandPaths[product.brand.id] ?? null) : null,
    requestedVariant: url.searchParams.get("variant"),
    t,
  })
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      <theme.ProductPage view={view} t={t} actions={{ addToCart, changeCartLine }} />
    </>
  )
}
