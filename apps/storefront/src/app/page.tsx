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
  storefrontSettings,
} from "@/lib/store-api/requests"
import { childrenOf } from "@/lib/views/categories"
import { productCards, variantIdsOf } from "@/lib/views/product"
import { theme } from "@/theme"

export async function generateMetadata(): Promise<Metadata> {
  return metadataOf((await siteSeo()).home)
}

/** The home page: the shop's structured data, its top categories and newest products. */
export default async function HomePage() {
  const [site, categories, { products }, { storefront }] = await Promise.all([
    siteSeo(),
    allCategories(),
    listProducts({ limit: 12, order: "-created_at" }),
    storefrontSettings(),
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
  const categoryLinks = top.flatMap((category) => {
    const path = categoryPaths[category.id]
    return path ? [{ label: category.name, path }] : []
  })
  // The shop's own opening (D3), else its name and first two categories
  const { hero } = storefront
  return (
    <>
      <JsonLd blocks={site.home.jsonLd} />
      <theme.HomePage
        t={t}
        view={{
          eyebrow: hero?.eyebrow ?? null,
          heading: hero?.heading ?? site.shop.name,
          intro: hero?.text ?? null,
          actions: hero
            ? hero.links.map((link) => ({ label: link.label, path: link.href }))
            : categoryLinks.slice(0, 2),
          categories: categoryLinks,
          products: productCards(products, productPaths, displays),
        }}
      />
    </>
  )
}
