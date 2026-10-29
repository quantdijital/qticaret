import { model } from "@medusajs/framework/utils"

/**
 * A text a content draft provider wrote (adr/0005, F10.13): always a
 * draft, its source `ai_draft`; it reaches the page only once staff
 * approve it. The prompt it was asked with is kept: product data only,
 * filtered, so the shop sees what left.
 */
export const ContentDraft = model
  .define("content_draft", {
    id: model.id({ prefix: "cdraft" }).primaryKey(),
    entity_type: model.text(),
    entity_id: model.text(),
    /** product_description, seo_title, seo_description. */
    kind: model.text(),
    text: model.text(),
    prompt: model.text(),
    provider: model.text(),
    source: model.text().default("ai_draft"),
    /** refused: the advisor's rules turned it down, never offered. */
    status: model.enum(["draft", "approved", "rejected", "refused"]),
    /** The rules it failed, when refused. */
    problems: model.json().nullable(),
    created_by: model.text(),
    decided_by: model.text().nullable(),
    decided_at: model.dateTime().nullable(),
  })
  .indexes([{ on: ["entity_type", "entity_id"], where: "deleted_at IS NULL" }])
