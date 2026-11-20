import "server-only"
import type { StoreContentSummary, StoreContentTerm } from "@qticaret/types"
import type { PostCardView, ProductCardView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { blogPosts } from "@/lib/store-api/blog"
import { isStoreApiError } from "@/lib/store-api/errors"
import { cardProductIds } from "@/lib/views/content-extras"
import { postCards } from "@/lib/views/posts"
import { productsInOrder, railCards } from "@/lib/views/section-data"

/**
 * What a blog post shows beside its text (adr/0046 Ek 2026-11-05,
 * içerik sayfaları), fetched live: its related posts and products. A
 * backend that does not answer leaves the extra out; the post still shows
 * its text. A page's payment and shipping facts are its sections'
 * (`lib/views/page-facts.ts`).
 */

const RELATED = 3

/** Up to three other posts: the same category's newest first, then the blog's newest. */
export async function relatedPosts(entry: {
  id: string
  category?: StoreContentTerm | null
}): Promise<PostCardView[]> {
  try {
    const [filed, newest] = await Promise.all([
      entry.category
        ? blogPosts(0, RELATED + 1, "category", entry.category.handle)
        : Promise.resolve({ entries: [] as StoreContentSummary[], count: 0 }),
      blogPosts(0, RELATED * 2),
    ])
    const seen = new Set([entry.id])
    const chosen = [...filed.entries, ...newest.entries].filter((post) => {
      if (seen.has(post.id)) {
        return false
      }
      seen.add(post.id)
      return true
    })
    return postCards(chosen.slice(0, RELATED), t)
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

const TEXT_PRODUCTS = 8

/** The products the text's product cards name, as cards with their live prices. */
export async function textProducts(html: string): Promise<ProductCardView[]> {
  const ids = cardProductIds(html).slice(0, TEXT_PRODUCTS)
  if (ids.length === 0) {
    return []
  }
  try {
    return await railCards(await productsInOrder(ids))
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}
