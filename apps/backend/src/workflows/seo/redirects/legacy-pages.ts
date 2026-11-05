import type { MedusaContainer } from "@medusajs/framework/types"
import { LISTING_PAGE_SIZE } from "../../../lib/seo/facets"
import { parseRequestPath } from "../../../lib/seo/redirects"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"
import { CATALOG_ENTITY_TYPES } from "../../catalog/entity-paths"
import { livePostsUnder } from "../../content/term-reads"
import { LISTING_TYPES } from "../listing"
import { ALL_PRODUCTS, countListing } from "../listing-plan"
import type { Resolution } from "./resolve"

/**
 * How many pages a list here has (adr/0059), so an old numbered page
 * lands on the same page number while there is one, else on the first.
 */

export type Follow = (request: { path: string; query: URLSearchParams }) => Promise<Resolution>

/** Posts a blog list shows a page (the storefront's `screens/blog.tsx`). */
export const BLOG_PAGE_SIZE = 12

/** The storefront's own lists no record holds: the whole catalogue and the blog. */
export const LIST_PAGES: ReadonlySet<string> = new Set(["/magaza", "/blog"])

const pagesOf = (count: number, size: number) => Math.max(1, Math.ceil(count / size))

const BLOG_ARCHIVES: ReadonlySet<string> = new Set([
  CATALOG_ENTITY_TYPES.post_category,
  CATALOG_ENTITY_TYPES.post_tag,
])

/**
 * The page count of the list at `path` (a page's address, maybe with its
 * query); null when no list answers there.
 */
export async function pageCountOf(
  container: MedusaContainer,
  follow: Follow,
  path: string
): Promise<number | null> {
  const request = parseRequestPath(path)
  if (!request) {
    return null
  }
  if (request.path === "/magaza") {
    const all = { entity_type: ALL_PRODUCTS, entity_id: ALL_PRODUCTS }
    return pagesOf(await countListing(container, all, []), LISTING_PAGE_SIZE)
  }
  if (request.path === "/blog") {
    const [, count] = await container
      .resolve<ContentModuleService>(CONTENT_MODULE)
      .listAndCountContentEntries(
        { kind: "post", status: "published" },
        { take: 1, select: ["id"] }
      )
    return pagesOf(count, BLOG_PAGE_SIZE)
  }
  const page = await follow({ path: request.path, query: new URLSearchParams() })
  if (page.type !== "entity") {
    return null
  }
  if (LISTING_TYPES.has(page.entity_type)) {
    return pagesOf(await countListing(container, page, []), LISTING_PAGE_SIZE)
  }
  if (BLOG_ARCHIVES.has(page.entity_type)) {
    const { count } = await livePostsUnder(container, [page.entity_id], { skip: 0, take: 1 })
    return pagesOf(count, BLOG_PAGE_SIZE)
  }
  return null
}
