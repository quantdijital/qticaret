import { Modules } from "@medusajs/framework/utils"
import type { ROBOTS_OVERRIDES } from "../../modules/seo-meta/models/seo-meta"

/**
 * The page types that carry SEO fields today (adr/0015) and how each is
 * read and linked: the query entity and the link's key on Medusa's side.
 * Brand and content pages join with their modules (F3.11, F3.16).
 */
export const SEO_ENTITIES = {
  product: { entity: "product", linkKey: "product_id" },
  category: { entity: "product_category", linkKey: "product_category_id" },
  collection: { entity: "product_collection", linkKey: "product_collection_id" },
} as const

export type SeoEntityType = keyof typeof SEO_ENTITIES

export const isSeoEntityType = (value: string): value is SeoEntityType =>
  Object.hasOwn(SEO_ENTITIES, value)

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

export const LINK_MODULE = Modules.PRODUCT
