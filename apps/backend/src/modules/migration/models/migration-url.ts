import { model } from "@medusajs/framework/utils"

// `not_found`: a 404 the storefront answered after cutover (F14.7's watch)
export const URL_ORIGINS = ["source", "sitemap", "search_console", "not_found"] as const
export const URL_DECISIONS = ["auto", "redirect", "gone"] as const

/**
 * An address of the shop's old site (F14.7, adr/0042 §8): from the
 * migrated records, the old sitemap or Search Console's top pages, with
 * the clicks Search Console counted. The record it moved as, when one
 * did: its path is then kept for that record (a 301 that follows it).
 * Otherwise the owner decides: a 301 to a page here, or gone (410).
 * `address` is the path as rules store it, and a query string when the
 * old site had one (a rule cannot take that: a server rule must).
 */
export const MigrationUrl = model
  .define("migration_url", {
    id: model.id({ prefix: "murl" }).primaryKey(),
    address: model.text(),
    path: model.text(),
    query: model.text().nullable(),
    origins: model.array(),
    clicks: model.number().nullable(),
    entity_type: model.text().nullable(),
    entity_id: model.text().nullable(),
    decision: model.enum([...URL_DECISIONS]).default("auto"),
    /** A page here, for a `redirect` decision. */
    target: model.text().nullable(),
    decided_by: model.text().nullable(),
    /** What the last apply did: `reserved`, `redirected`, `gone`, `covered` or why not. */
    outcome: model.text().nullable(),
    applied_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["address"], unique: true, where: "deleted_at IS NULL" },
    { on: ["clicks"], where: "deleted_at IS NULL" },
  ])
