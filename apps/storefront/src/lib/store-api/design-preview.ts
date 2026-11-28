import "server-only"
import { cache } from "react"
import type { StoreLayout, StorePageLayout } from "@qticaret/types"
import { isNotFound } from "./errors"
import { storeGet } from "./server"

/**
 * A saved look through its signed link (adr/0064, as Shopify's
 * `preview_theme_id`): the look drawn as applying it would make the draft,
 * its content pages' layouts too. Each null when the link no longer opens
 * (ended, renamed, removed); never kept, deduplicated within the request.
 */

const DESIGN = "/store/storefront-layout/design"

/** The look's design; null: the link does not open. */
export const designPreview = cache(async (token: string): Promise<StoreLayout | null> => {
  try {
    const { layout } = await storeGet<{ layout: StoreLayout }>(
      `${DESIGN}/${encodeURIComponent(token)}`
    )
    return layout
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
})

/** A live content page's layout in the look; null: none, or the link does not open. */
export const designPageLayout = cache(
  async (token: string, id: string): Promise<StorePageLayout | null> => {
    try {
      const answer = await storeGet<{ page: StorePageLayout | null }>(
        `${DESIGN}/${encodeURIComponent(token)}/pages/${encodeURIComponent(id)}`
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
