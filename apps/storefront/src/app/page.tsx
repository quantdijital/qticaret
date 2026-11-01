import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import { metadataOf } from "@/lib/seo/metadata"
import {
  allCategories,
  listProducts,
  pathsOf,
  priceDisplays,
  siteSeo,
} from "@/lib/store-api/requests"
import { childrenOf } from "@/lib/views/categories"
import { productCards, variantIdsOf } from "@/lib/views/product"
import { theme } from "@/theme"

export async function generateMetadata(): Promise<Metadata> {
  return metadataOf((await siteSeo()).home)
}

/** The home page: the shop's structured data, its top categories and newest products. */
export default async function HomePage() {
  const [site, categories, { products }] = await Promise.all([
    siteSeo(),
    allCategories(),
    listProducts({ limit: 12, order: "-created_at" }),
  ])
  const top = childrenOf(categories, null)
  const [productPaths, categoryPaths, displays] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    pathsOf(
      "product_category",
      top.map((category) => category.id)
    ),
    priceDisplays(variantIdsOf(products)),
  ])
  return (
    <>
      <JsonLd blocks={site.home.jsonLd} />
      <theme.HomePage
        t={t}
        view={{
          heading: site.home.title,
          intro: site.home.description === "" ? null : site.home.description,
          categories: top.flatMap((category) => {
            const path = categoryPaths[category.id]
            return path ? [{ label: category.name, path }] : []
          }),
          products: productCards(products, productPaths, displays),
        }}
      />
    </>
  )
}
