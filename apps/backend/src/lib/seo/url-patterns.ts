/**
 * Storefront paths of catalog records (docs/13 §2.2). The tenant's URL
 * style (SEO settings) chooses the prefixed form or the flat one; every
 * segment is a handle, already a valid slug. Brands (F3.11) and content
 * pages (F3.16) add theirs.
 */

export type UrlStyle = "prefixed" | "flat"

/**
 * Categories have a third style (adr/0017 Ek 2026-11-23): `nested`, the
 * tree without the `/kategori` prefix (`/hediyelik-esyalar/caki-kutusu`),
 * as a WooCommerce site with its category base taken off serves them.
 */
export type CategoryUrlStyle = UrlStyle | "nested"

export const URL_STYLES: readonly UrlStyle[] = ["prefixed", "flat"]
export const CATEGORY_URL_STYLES: readonly CategoryUrlStyle[] = ["prefixed", "nested", "flat"]

export const productPath = (handle: string, style: UrlStyle): string =>
  style === "flat" ? `/${handle}` : `/urun/${handle}`

/**
 * `handles` run from the root category down to this one: the prefixed and
 * nested styles carry the tree, the flat one the category's own handle.
 */
export function categoryPath(handles: readonly string[], style: CategoryUrlStyle): string {
  const own = handles.at(-1)
  if (own === undefined) {
    throw new Error("categoryPath needs at least the category's own handle")
  }
  switch (style) {
    case "flat":
      return `/${own}`
    case "nested":
      return `/${handles.join("/")}`
    case "prefixed":
      return `/kategori/${handles.join("/")}`
  }
}

export const collectionPath = (handle: string): string => `/koleksiyon/${handle}`

export const brandPath = (handle: string, style: UrlStyle): string =>
  style === "flat" ? `/${handle}` : `/marka/${handle}`

/** A content page sits at the root in either style; a reserved word (`/blog`, `/urun`) cannot be one. */
export const pagePath = (handle: string): string => `/${handle}`

export const postPath = (handle: string): string => `/blog/${handle}`

/** The blog's archives (adr/0019 ek 2026-11-03): `/blog/kategori` and `/blog/etiket` hold no post. */
export const POST_ARCHIVE_PREFIXES = { category: "/blog/kategori", tag: "/blog/etiket" } as const

export const postCategoryPath = (handle: string): string =>
  `${POST_ARCHIVE_PREFIXES.category}/${handle}`

export const postTagPath = (handle: string): string => `${POST_ARCHIVE_PREFIXES.tag}/${handle}`

/** A blog author's page (adr/0060): `/blog/yazar` holds no post. */
export const POST_AUTHOR_PREFIX = "/blog/yazar"

export const postAuthorPath = (handle: string): string => `${POST_AUTHOR_PREFIX}/${handle}`

/** The products on sale now (`/kampanyalar`): a storefront page of its own, no record's. */
export const SALE_PATH = "/kampanyalar"
