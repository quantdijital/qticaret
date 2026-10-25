import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sitemapIndex, urlsetFiles } from "../../lib/seo/sitemap"
import type { SitemapEntry, SitemapFile } from "../../lib/seo/sitemap"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { shopOf } from "./payload-sources"

/**
 * The sitemap's pages (docs/13 §6): live products, categories, brands and
 * collections at their paths now. Left out: pages marked noindex and pages
 * whose canonical points elsewhere (only canonical URLs belong here).
 */

const PAGE = 1_000

interface Row {
  id: string
  updated_at?: string | Date | null
  images?: ({ url: string } | null)[] | null
  seo_meta?: { robots_override?: string | null; canonical_override?: string | null } | null
}

interface KindSpec {
  kind: string
  entity: string
  type: string
  filters: Record<string, unknown>
  images: boolean
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
]

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
    "updated_at",
    "seo_meta.robots_override",
    "seo_meta.canonical_override",
    ...(spec.images ? ["images.url"] : []),
  ]
  const entries: SitemapEntry[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: spec.entity,
      fields,
      filters: spec.filters,
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
          lastmod: row.updated_at ? new Date(row.updated_at) : null,
          images: (row.images ?? []).flatMap((image) => (image ? [image.url] : [])),
        })
      }
    }
    if (data.length < PAGE) {
      return entries
    }
  }
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
  const files: SitemapFile[] = []
  for (const spec of KINDS) {
    files.push(...urlsetFiles(spec.kind, await entriesOf(container, spec, origin)))
  }
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
