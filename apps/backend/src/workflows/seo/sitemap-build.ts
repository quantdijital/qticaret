import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ORIGINALITY } from "../../lib/content/originality"
import { sitemapIndex, urlsetFiles } from "../../lib/seo/sitemap"
import type { SitemapEntry, SitemapFile } from "../../lib/seo/sitemap"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CONTENT_MODULE } from "../../modules/content"
import type ContentModuleService from "../../modules/content/service"
import { PRODUCT_REVIEWS_MODULE } from "../../modules/product-reviews"
import type ProductReviewsModuleService from "../../modules/product-reviews/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { liveLandingFilters } from "../content/landing-facet"
import { shopOf } from "./payload-sources"
import { SALE_PATH } from "../../lib/seo/url-patterns"
import { isAnythingOnSale } from "../pricing/sale-products"
import { termSitemapPaths } from "./sitemap-terms"

/**
 * The sitemap's pages (docs/13 §6): live products, categories, brands and
 * collections at their paths now. Left out: pages marked noindex, landing
 * pages served noindex for their text, and pages whose canonical points
 * elsewhere (only canonical URLs belong here).
 */

const PAGE = 1_000

interface Row {
  id: string
  updated_at?: string | Date | null
  revised_at?: string | Date | null
  published_at?: string | Date | null
  images?: ({ url: string } | null)[] | null
  seo_meta?: { robots_override?: string | null; canonical_override?: string | null } | null
}

interface KindSpec {
  kind: string
  entity: string
  type: string
  filters: Record<string, unknown>
  /** Filters read at build time, in place of `filters` (a landing page's category must show). */
  filtersOf?: (container: MedusaContainer) => Promise<Record<string, unknown>>
  images: boolean
  /** The fields whose date is the page's last meaningful change, first set first; else `updated_at`. */
  changed?: readonly ("revised_at" | "published_at")[]
}

const KINDS: readonly KindSpec[] = [
  {
    kind: "products",
    entity: "product",
    type: CATALOG_ENTITY_TYPES.product,
    filters: { status: "published" },
    images: true,
  },
  {
    kind: "categories",
    entity: "product_category",
    type: CATALOG_ENTITY_TYPES.category,
    filters: { is_active: true, is_internal: false },
    images: false,
  },
  {
    kind: "brands",
    entity: "brand",
    type: CATALOG_ENTITY_TYPES.brand,
    filters: { is_active: true },
    images: false,
  },
  {
    kind: "collections",
    entity: "product_collection",
    type: CATALOG_ENTITY_TYPES.collection,
    filters: {},
    images: false,
  },
  // F3.16
  {
    kind: "pages",
    entity: "content_entry",
    type: CATALOG_ENTITY_TYPES.page,
    filters: { kind: "page", status: "published" },
    images: false,
    // A cover or status change is no change of the text (docs/13 §6)
    changed: ["revised_at", "published_at"],
  },
  {
    kind: "posts",
    entity: "content_entry",
    type: CATALOG_ENTITY_TYPES.post,
    filters: { kind: "post", status: "published" },
    images: false,
    changed: ["revised_at", "published_at"],
  },
  {
    kind: "landings",
    entity: "landing_page",
    type: CATALOG_ENTITY_TYPES.landing,
    filters: { status: "published" },
    // Under 30% of its own text a page is served noindex (adr/0019 Ek 2026-11-05): out, as any noindex page
    filtersOf: async (container) => ({
      ...(await liveLandingFilters(container)),
      originality: { $gte: ORIGINALITY.noindex },
    }),
    images: false,
    changed: ["revised_at", "published_at"],
  },
]

const filtersOf = async (container: MedusaContainer, spec: KindSpec) =>
  spec.filtersOf ? spec.filtersOf(container) : spec.filters

// A page that asks not to be indexed, or names another page as canonical, stays out
const listed = (row: Row): boolean =>
  !row.seo_meta?.robots_override?.startsWith("noindex") && !row.seo_meta?.canonical_override

async function entriesOf(
  container: MedusaContainer,
  spec: KindSpec,
  origin: string
): Promise<SitemapEntry[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const fields = [
    "id",
    ...(spec.changed ?? ["updated_at"]),
    "seo_meta.robots_override",
    "seo_meta.canonical_override",
    ...(spec.images ? ["images.url"] : []),
  ]
  const lastmod = (row: Row): Date | null => {
    const value = spec.changed
      ? spec.changed.map((field) => row[field]).find(Boolean)
      : row.updated_at
    return value ? new Date(value) : null
  }
  const entries: SitemapEntry[] = []
  const filters = await filtersOf(container, spec)
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: spec.entity,
      fields,
      filters,
      pagination: { skip, take: PAGE, order: { id: "ASC" } },
    })
    const rows = (data as Row[]).filter(listed)
    const paths = new Map(
      (rows.length > 0
        ? await registry.listUrlEntries(
            {
              locale: CATALOG_LOCALE,
              entity_type: spec.type,
              entity_id: rows.map((row) => row.id),
              status: "active",
            },
            { select: ["entity_id", "path"] }
          )
        : []
      ).map((entry) => [entry.entity_id, entry.path])
    )
    for (const row of rows) {
      const path = paths.get(row.id)
      if (path) {
        entries.push({
          loc: new URL(path, origin).href,
          lastmod: lastmod(row),
          images: (row.images ?? []).flatMap((image) => (image ? [image.url] : [])),
        })
      }
    }
    if (data.length < PAGE) {
      return entries
    }
  }
}

/**
 * What a build now would list, counted (the SEO audit): live, listed
 * pages with an address, and the live, listed pages a build skips for
 * having none.
 */
export async function sitemapCounts(
  container: MedusaContainer
): Promise<{ expected: number; pathless: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
  const counts = { expected: 0, pathless: 0 }
  for (const spec of KINDS) {
    const filters = await filtersOf(container, spec)
    for (let skip = 0; ; skip += PAGE) {
      const { data } = await query.graph({
        entity: spec.entity,
        fields: ["id", "seo_meta.robots_override", "seo_meta.canonical_override"],
        filters,
        pagination: { skip, take: PAGE, order: { id: "ASC" } },
      })
      const ids = (data as Row[]).filter(listed).map((row) => row.id)
      const withPath = ids.length
        ? new Set(
            (
              await registry.listUrlEntries(
                {
                  locale: CATALOG_LOCALE,
                  entity_type: spec.type,
                  entity_id: ids,
                  status: "active",
                },
                { select: ["entity_id"] }
              )
            ).map((entry) => entry.entity_id)
          ).size
        : 0
      counts.expected += withPath
      counts.pathless += ids.length - withPath
      if (data.length < PAGE) {
        break
      }
    }
  }
  // The blog's archives with live posts (adr/0019 ek 2026-11-03)
  counts.expected += (await termSitemapPaths(container)).length
  return counts
}

/**
 * The storefront's own index pages (F18): the home page, the whole
 * catalogue and the category and brand indexes (always there, docs/20),
 * and the blog, the reviews page and the sale page once they have
 * something to show. No date: they change with everything under them.
 */
async function siteEntries(container: MedusaContainer, origin: string): Promise<SitemapEntry[]> {
  const [posts, reviews, sale] = await Promise.all([
    container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .listContentEntries({ kind: "post", status: "published" }, { select: ["id"], take: 1 }),
    container
      .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
      .listProductReviews({ status: "approved" }, { select: ["id"], take: 1 }),
    isAnythingOnSale(container),
  ])
  return [
    { loc: `${origin}/`, lastmod: null },
    { loc: `${origin}/magaza`, lastmod: null },
    { loc: `${origin}/kategoriler`, lastmod: null },
    { loc: `${origin}/markalar`, lastmod: null },
    ...(posts.length > 0 ? [{ loc: `${origin}/blog`, lastmod: null }] : []),
    ...(reviews.length > 0 ? [{ loc: `${origin}/yorumlar`, lastmod: null }] : []),
    // Noindex while nothing is on sale (adr/0019 ek 2026-11-03)
    ...(sale ? [{ loc: `${origin}${SALE_PATH}`, lastmod: null }] : []),
  ]
}

export interface BuiltSitemap {
  /** The index first (`sitemap.xml`), then a file per kind and page of URLs. */
  files: SitemapFile[]
  urls: number
}

/** Every sitemap file, or null while the shop has no canonical host (URLs must be absolute). */
export async function buildSitemap(container: MedusaContainer): Promise<BuiltSitemap | null> {
  const shop = await shopOf(container)
  if (!shop.canonicalHost) {
    return null
  }
  const origin = `https://${shop.canonicalHost}`
  const files: SitemapFile[] = [...urlsetFiles("site", await siteEntries(container, origin))]
  for (const spec of KINDS) {
    files.push(...urlsetFiles(spec.kind, await entriesOf(container, spec, origin)))
  }
  // The blog's archives (adr/0019 ek 2026-11-03); no date: their posts change them
  const archives = await termSitemapPaths(container)
  files.push(
    ...urlsetFiles(
      "blog",
      archives.map((path) => ({ loc: new URL(path, origin).href, lastmod: null }))
    )
  )
  const now = new Date()
  const index: SitemapFile = {
    name: "sitemap.xml",
    content: sitemapIndex(
      files.map((file) => ({ name: file.name, lastmod: now })),
      origin
    ),
    urls: 0,
  }
  return { files: [index, ...files], urls: files.reduce((total, file) => total + file.urls, 0) }
}
