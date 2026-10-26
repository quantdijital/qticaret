import { Modules } from "@medusajs/framework/utils"
import { BRANDS_MODULE } from "../../modules/brands"
import { CONTENT_MODULE } from "../../modules/content"
import type { ROBOTS_OVERRIDES } from "../../modules/seo-meta/models/seo-meta"

/**
 * The page types that carry SEO fields today (adr/0015) and how each is
 * read and linked: the query entity, the module that owns it and the
 * link's key on its side. Content pages and blog posts are one record
 * (F3.16), told apart by its kind.
 */
export const SEO_ENTITIES = {
  product: { entity: "product", module: Modules.PRODUCT, linkKey: "product_id" },
  category: { entity: "product_category", module: Modules.PRODUCT, linkKey: "product_category_id" },
  collection: {
    entity: "product_collection",
    module: Modules.PRODUCT,
    linkKey: "product_collection_id",
  },
  brand: { entity: "brand", module: BRANDS_MODULE, linkKey: "brand_id" },
  page: {
    entity: "content_entry",
    module: CONTENT_MODULE,
    linkKey: "content_entry_id",
    kind: "page",
  },
  post: {
    entity: "content_entry",
    module: CONTENT_MODULE,
    linkKey: "content_entry_id",
    kind: "post",
  },
} as const

export type SeoEntityType = keyof typeof SEO_ENTITIES

export const isSeoEntityType = (value: string): value is SeoEntityType =>
  Object.hasOwn(SEO_ENTITIES, value)

/** The query filter for one page of the type: a content entry also by its kind (a post is no page). */
export function seoEntityFilter(type: SeoEntityType, id: string): Record<string, unknown> {
  const spec = SEO_ENTITIES[type]
  return "kind" in spec ? { id, kind: spec.kind } : { id }
}

/** The fields a page owns (adr/0015); hashes are worked out, never sent. */
export const SEO_FIELDS = [
  "seo_title",
  "seo_description",
  "focus_keyword",
  "canonical_override",
  "robots_override",
  "og_image_override",
  "og_image_alt",
] as const

export type SeoField = (typeof SEO_FIELDS)[number]
export type RobotsOverride = (typeof ROBOTS_OVERRIDES)[number]

export interface SeoValues {
  seo_title: string | null
  seo_description: string | null
  focus_keyword: string | null
  canonical_override: string | null
  robots_override: RobotsOverride | null
  og_image_override: string | null
  og_image_alt: string | null
}
