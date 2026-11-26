import { t } from "@/lib/i18n"
import { breadcrumbJsonLd } from "@/lib/seo/breadcrumbs"
import { categoryIndexJsonLd } from "@/lib/seo/category-index"
import { JsonLd } from "@/lib/seo/JsonLd"
import { categoryImages } from "@/lib/store-api/extras"
import { allBrands, allCategories, pathsOf, siteSeo } from "@/lib/store-api/requests"
import { brandGroups } from "@/lib/views/brands"
import { categoryIndex } from "@/lib/views/category-index"
import { shopWords } from "@/lib/views/theme-settings"
import { theme } from "@/theme"

export const CATEGORIES_PATH = "/kategoriler"
export const BRANDS_PATH = "/markalar"

/** An index page's trail and its BreadcrumbList: Home → the page. */
async function trailOf(title: string, path: string) {
  const site = await siteSeo()
  return {
    breadcrumbs: [
      { label: t("home.label"), path: "/" },
      { label: title, path: null },
    ],
    jsonLd: breadcrumbJsonLd(site.canonical_host, [
      { name: t("home.label"), path: "/" },
      { name: title, path },
    ]),
  }
}

/**
 * `/kategoriler` (docs/20 "sayfalar"): every live category, top ones with
 * those right below them, each a picture tile at its page with its
 * product count: a way in for shoppers and crawlers to every category.
 */
export async function CategoriesScreen() {
  const title = t("categories.title")
  const categories = await allCategories()
  const [paths, trail, pictures, site] = await Promise.all([
    pathsOf(
      "product_category",
      categories.map((category) => category.id)
    ),
    trailOf(title, CATEGORIES_PATH),
    categoryImages(),
    siteSeo(),
  ])
  const index = await categoryIndex(categories, paths, pictures)
  const jsonLd = [
    ...trail.jsonLd,
    ...categoryIndexJsonLd(
      site.canonical_host,
      { name: title, path: CATEGORIES_PATH },
      index.categories
    ),
  ]
  return (
    <>
      <JsonLd blocks={jsonLd} />
      <theme.CategoriesPage
        t={await shopWords()}
        view={{
          title,
          breadcrumbs: trail.breadcrumbs,
          categories: index.categories,
          total: index.total,
        }}
      />
    </>
  )
}

/**
 * `/markalar` (docs/20 "sayfalar"): the shop's active brands by first
 * letter in Turkish alphabetical order, each at its page, with its logo.
 */
export async function BrandsScreen() {
  const title = t("brands.title")
  const brands = await allBrands()
  const [paths, trail] = await Promise.all([
    pathsOf(
      "brand",
      brands.map((brand) => brand.id)
    ),
    trailOf(title, BRANDS_PATH),
  ])
  return (
    <>
      <JsonLd blocks={trail.jsonLd} />
      <theme.BrandsPage
        t={t}
        view={{
          title,
          breadcrumbs: trail.breadcrumbs,
          groups: brandGroups(brands, paths, t("brands.other")),
        }}
      />
    </>
  )
}
