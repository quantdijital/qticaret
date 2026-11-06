import type { RequestPath } from "../redirects"

/**
 * An old platform's own address that no record here holds and no rule
 * names (adr/0059): what kind of address it was, so resolve can answer it
 * with one 301 to the page that took its place, or a 410.
 */
export type LegacyAddress =
  /** A list's numbered page (`/x/page/2/`, `?paged=2`): the list's address, then its page. */
  | { kind: "paged"; base: RequestPath; page: number }
  /** A record by the old platform's id (`?p=12`, `?page_id=7`): its source keys, likeliest first. */
  | { kind: "record_id"; keys: string[] }
  /** A product by its old slug (`?product=dokum-tava`). */
  | { kind: "product_slug"; slug: string }
  /** A product category by its old slug (`?product_cat=tavalar`). */
  | { kind: "category_slug"; slug: string }
  /** A product tag's archive: tags do not move (adr/0042 Ek 2026-11-03 §3); a search for it. */
  | { kind: "product_tag"; slug: string }
  /**
   * A blog category's or tag's archive no migration kept, or an author's
   * (adr/0060): the blog's own for the slug, else the blog.
   */
  | { kind: "post_term"; taxonomy: "category" | "tag" | "author"; slug: string }
  /** The old site's search (`?s=`). */
  | { kind: "search"; text: string }
  /** A file in the old media library (`/wp-content/uploads/...`). */
  | { kind: "upload"; path: string }
  /** One of the storefront's own pages (`/blog` for a date archive, `/sepet` for the cart). */
  | { kind: "page"; path: string }
  /** The old platform's machinery (feeds, login, XML-RPC): nothing here takes its place. */
  | { kind: "gone" }
