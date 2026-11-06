import { model } from "@medusajs/framework/utils"

/** The pages that carry their own SEO fields (docs/13 §1); brand and content modules link later. */
export const SEO_ENTITY_TYPES = [
  "product",
  "category",
  "collection",
  "brand",
  "page",
  "post",
  "landing",
  // Blog categories and tags (adr/0019 ek 2026-11-03)
  "post_category",
  "post_tag",
  // Blog authors' pages (adr/0060)
  "post_author",
] as const

/** A page's robots choice when it differs from what its state implies (docs/13 §5). */
export const ROBOTS_OVERRIDES = ["index_follow", "noindex_follow", "noindex_nofollow"] as const

/**
 * A page's SEO fields (adr/0015), linked one to one to the product,
 * category or collection; empty fields fall back to the shop's templates.
 * - `canonical_override`: a path on this site only;
 * - `og_image_override`: a file from the shop's own uploads (its id), with
 *   its alt text;
 * - `title_hash`, `description_hash`: the normalised text's hash, indexed,
 *   so a duplicate within the same page type is found without a scan.
 * The raw fields never reach the Store API (focus_keyword is marketing
 * data); the storefront gets the resolved payload (F3.4b).
 */
export const SeoMeta = model
  .define("seo_meta", {
    id: model.id({ prefix: "seo" }).primaryKey(),
    entity_type: model.enum([...SEO_ENTITY_TYPES]),
    seo_title: model.text().nullable(),
    seo_description: model.text().nullable(),
    focus_keyword: model.text().nullable(),
    canonical_override: model.text().nullable(),
    robots_override: model.enum([...ROBOTS_OVERRIDES]).nullable(),
    og_image_override: model.text().nullable(),
    og_image_alt: model.text().nullable(),
    title_hash: model.text().nullable(),
    description_hash: model.text().nullable(),
  })
  .indexes([
    { on: ["entity_type", "title_hash"], where: "title_hash IS NOT NULL" },
    { on: ["entity_type", "description_hash"], where: "description_hash IS NOT NULL" },
  ])
