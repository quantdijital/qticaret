import { model } from "@medusajs/framework/utils"

export const CONTENT_TERM_KINDS = ["category", "tag"] as const

/**
 * A blog category or tag (F3.16, adr/0019 ek 2026-11-03): its archive
 * sits at `/blog/kategori/{handle}` or `/blog/etiket/{handle}`. The handle
 * is one term's per kind. No personal data.
 */
export const ContentTerm = model
  .define("content_term", {
    id: model.id({ prefix: "cterm" }).primaryKey(),
    kind: model.enum([...CONTENT_TERM_KINDS]),
    name: model.text(),
    handle: model.text(),
    description: model.text().nullable(),
    // The description as a content document (adr/0075 Ek 2026-11-24); `description` keeps its plain text
    description_doc: model.json().nullable(),
    // The shop's order in lists (a category menu); then by name
    rank: model.number().default(0),
  })
  .indexes([
    { on: ["kind", "handle"], unique: true, where: "deleted_at IS NULL" },
    { on: ["kind", "rank"], where: "deleted_at IS NULL" },
  ])

/**
 * A blog post's category or tag, one row per pair. A post has at most one
 * category (the workflow's rule, and this table's index) and any tags.
 */
export const ContentEntryTerm = model
  .define("content_entry_term", {
    id: model.id({ prefix: "cetrm" }).primaryKey(),
    entry_id: model.text(),
    term_id: model.text(),
    term_kind: model.enum([...CONTENT_TERM_KINDS]),
  })
  .indexes([
    { on: ["entry_id", "term_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["entry_id"], unique: true, where: "term_kind = 'category' AND deleted_at IS NULL" },
    { on: ["term_id"], where: "deleted_at IS NULL" },
  ])
