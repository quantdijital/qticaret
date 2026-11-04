import { t } from "@/lib/i18n"
import { breadcrumbJsonLd } from "@/lib/seo/breadcrumbs"
import { JsonLd } from "@/lib/seo/JsonLd"
import { categoryImages } from "@/lib/store-api/extras"
import { allBrands, allCategories, pathsOf, siteSeo } from "@/lib/store-api/requests"
import { brandGroups } from "@/lib/views/brands"
import { categoryTree } from "@/lib/views/categories"
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
 * `/kategoriler` (docs/20 "sayfalar"): every live category as a tree, top
 * ones with those below them, each at its page: a way in for shoppers
 * and crawlers to every category.
 */
export async function CategoriesScreen() {
  const title = t("categories.title")
  const categories = await allCategories()
  const [paths, trail, pictures] = await Promise.all([
    pathsOf(
      "product_category",
      categories.map((category) => category.id)
    ),
    trailOf(title, CATEGORIES_PATH),
    categoryImages(),
  ])
  return (
    <>
      <JsonLd blocks={trail.jsonLd} />
      <theme.CategoriesPage
        t={t}
        view={{
          title,
          breadcrumbs: trail.breadcrumbs,
          categories: categoryTree(categories, paths, pictures),
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
