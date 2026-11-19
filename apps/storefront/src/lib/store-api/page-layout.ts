import "server-only"
import { cache } from "react"
import type { StorePageLayout } from "@qticaret/types"
import type { ContentEntry } from "./content-entry"
import { isNotFound } from "./errors"
import { storeGet, storePublicGet } from "./server"

/**
 * A content page's own layout (adr/0073 §6), read from the one of the
 * three answers the request is on, each deduplicated within the request
 * by React's `cache`. Only the live one is kept for every shopper (a
 * minute in this process, dropped by the layout's refresh signal): a
 * signed link's and the live session's carry their token and are never
 * kept, as their own design reads.
 */

const page = (id: string) => encodeURIComponent(id)

/** The live page's layout as published; null: none (or not a live page). */
export const publishedPageLayout = cache(async (id: string): Promise<StorePageLayout | null> => {
  const answer = await storePublicGet<{ page: StorePageLayout | null }>(
    `/store/storefront-layout/pages/${page(id)}`
  )
  return answer.page
})

/** A live page's layout in the draft a signed design link opens; null: none, or the link does not open. */
export const previewPageLayout = cache(
  async (token: string, id: string): Promise<StorePageLayout | null> => {
    try {
      const answer = await storeGet<{ page: StorePageLayout | null }>(
        `/store/storefront-layout/preview/${encodeURIComponent(token)}/pages/${page(id)}`
      )
      return answer.page
    } catch (error) {
      if (isNotFound(error)) {
        return null
      }
      throw error
    }
  }
)

/** What the theme editor's live session reads of a content page: its layout in the draft and the page itself. */
export interface SessionPage {
  page: StorePageLayout | null
  /** The page, in draft or live, as `GET /store/content/:id` gives a live one. */
  entry: ContentEntry
}

/**
 * A content page, in draft or live, with its layout in the draft as last
 * saved (adr/0073 §5): the live session's read. Null when the session no
 * longer opens or names no such page (a 404).
 */
export const sessionPage = cache(async (token: string, id: string): Promise<SessionPage | null> => {
  try {
    const answer = await storeGet<SessionPage>(
      `/store/storefront-layout/session/${encodeURIComponent(token)}/pages/${page(id)}`
    )
    return { page: answer.page, entry: answer.entry }
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
})
