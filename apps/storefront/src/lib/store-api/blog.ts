import "server-only"
import { cache } from "react"
import type {
  StoreContentAuthorPage,
  StoreContentSummary,
  StoreContentTermSummary,
} from "@qticaret/types"
import { storeGet, storePublicGet } from "./server"

export type BlogTermKind = StoreContentTermSummary["kind"]
/** What narrows the blog's posts: a category's, a tag's or an author's (adr/0060), by handle. */
export type BlogFilter = BlogTermKind | "author"

/**
 * Live blog posts, newest first, a page at a time (F3.16); a category's,
 * tag's (adr/0019 ek 2026-11-03) or author's (adr/0060) only, by its handle.
 */
export const blogPosts = cache(
  (offset: number, limit: number, kind: BlogFilter | null = null, handle: string | null = null) =>
    storeGet<{ entries: StoreContentSummary[]; count: number }>("/store/content", {
      kind: "post",
      offset,
      limit,
      ...(kind && handle ? { [kind]: handle } : {}),
    })
)

/** The blog's categories or tags that file live posts, in the shop's order, with how many. */
export const blogTerms = cache(async (kind: BlogTermKind) => {
  const { terms } = await storePublicGet<{ terms: StoreContentTermSummary[] }>(
    "/store/content/terms",
    { kind }
  )
  return terms
})

/** A blog author (adr/0060), as the author's page shows them, with their live posts counted. */
export const blogAuthor = cache(async (id: string) => {
  const { author } = await storePublicGet<{ author: StoreContentAuthorPage }>(
    `/store/content/authors/${encodeURIComponent(id)}`
  )
  return author
})
