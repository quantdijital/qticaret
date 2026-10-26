import { model } from "@medusajs/framework/utils"

export const ASSESSED_KINDS = [
  "product",
  "category",
  "brand",
  "collection",
  "page",
  "post",
] as const

/**
 * A page's latest SEO assessment (docs/14 §1): its score, grade and
 * findings, the hashes of the title and description it shows, whether it
 * is live and indexable, and the rules version that made them. One row per page,
 * replaced on every assessment; lists and the shop's score read these.
 */
export const SeoAssessment = model
  .define("seo_assessment", {
    id: model.id({ prefix: "seoas" }).primaryKey(),
    entity_type: model.enum([...ASSESSED_KINDS]),
    entity_id: model.text(),
    score: model.number(),
    grade: model.enum(["excellent", "good", "needs_work", "poor"]),
    issues: model.json(),
    critical: model.number().default(0),
    // The search result texts as shown (own or template), hashed: duplicates
    // across the shop are found by index (docs/14 S-DUP-01, P-TITLE-02)
    title_hash: model.text().nullable(),
    description_hash: model.text().nullable(),
    // Live and indexable (published or active, not noindex, its own
    // canonical): only these compete in search, so only these are duplicates
    is_listed: model.boolean().default(false),
    rules_version: model.number(),
    computed_at: model.dateTime(),
  })
  .indexes([
    { on: ["entity_type", "entity_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["entity_type", "score"], where: "deleted_at IS NULL" },
    {
      on: ["entity_type", "title_hash"],
      where: "deleted_at IS NULL AND is_listed IS TRUE AND title_hash IS NOT NULL",
    },
    {
      on: ["entity_type", "description_hash"],
      where: "deleted_at IS NULL AND is_listed IS TRUE AND description_hash IS NOT NULL",
    },
  ])
