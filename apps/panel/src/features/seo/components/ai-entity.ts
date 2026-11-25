import type { AiEntity } from "@/features/ai/api/suggestions"
import type { SeoEntityType } from "@/features/seo/api/seo-meta"

/**
 * The records the AI core can write a search title and description for
 * (adr/0071 §8, docs/22 PR 1-1; adr/0074 §5): a product, a category, a
 * collection, a brand, a content page and a blog post. Any other SEO card
 * (landing, a blog archive) has no button.
 */
export const aiEntityOf = (type: SeoEntityType, id: string): AiEntity | null =>
  type === "product" ||
  type === "category" ||
  type === "collection" ||
  type === "brand" ||
  type === "page" ||
  type === "post"
    ? { type, id }
    : null
