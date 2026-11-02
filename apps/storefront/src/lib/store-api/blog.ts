import "server-only"
import { cache } from "react"
import type { StoreContentSummary, StoreContentTermSummary } from "@qticaret/types"
import { storeGet, storePublicGet } from "./server"

export type BlogTermKind = StoreContentTermSummary["kind"]

/**
 * Live blog posts, newest first, a page at a time (F3.16); a category's or
 * tag's only, by its handle (adr/0019 ek 2026-11-03).
 */
export const blogPosts = cache(
  (offset: number, limit: number, kind: BlogTermKind | null = null, handle: string | null = null) =>
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
