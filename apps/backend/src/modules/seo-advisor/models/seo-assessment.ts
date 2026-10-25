import { model } from "@medusajs/framework/utils"

export const ASSESSED_KINDS = ["product", "category", "brand", "collection"] as const

/**
 * A page's latest SEO assessment (docs/14 §1): its score, grade and
 * findings, and the rules version that made them. One row per page,
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
    rules_version: model.number(),
    computed_at: model.dateTime(),
  })
  .indexes([
    { on: ["entity_type", "entity_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["entity_type", "score"], where: "deleted_at IS NULL" },
  ])
