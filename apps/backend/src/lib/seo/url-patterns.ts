/**
 * Storefront paths of catalog records (docs/13 §2.2). The tenant's URL
 * style (SEO settings) chooses the prefixed form or the flat one; every
 * segment is a handle, already a valid slug. Brands (F3.11) and content
 * pages (F3.16) add theirs.
 */

export type UrlStyle = "prefixed" | "flat"

export const productPath = (handle: string, style: UrlStyle): string =>
  style === "flat" ? `/${handle}` : `/urun/${handle}`

/** `handles` run from the root category down to this one; the URL carries the tree. */
export function categoryPath(handles: readonly string[], style: UrlStyle): string {
  const own = handles.at(-1)
  if (own === undefined) {
    throw new Error("categoryPath needs at least the category's own handle")
  }
  return style === "flat" ? `/${own}` : `/kategori/${handles.join("/")}`
}

export const collectionPath = (handle: string): string => `/koleksiyon/${handle}`

export const brandPath = (handle: string, style: UrlStyle): string =>
  style === "flat" ? `/${handle}` : `/marka/${handle}`

/** A content page sits at the root in either style; a reserved word (`/blog`, `/urun`) cannot be one. */
export const pagePath = (handle: string): string => `/${handle}`

export const postPath = (handle: string): string => `/blog/${handle}`
