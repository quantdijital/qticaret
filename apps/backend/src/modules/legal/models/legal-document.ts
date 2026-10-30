import { model } from "@medusajs/framework/utils"
import { LEGAL_KINDS } from "../../../lib/legal/tokens"

export const LEGAL_STATUSES = ["draft", "published", "retired"] as const
export type LegalStatus = (typeof LEGAL_STATUSES)[number]

/**
 * A version of one of the shop's legal texts (F13.1, adr/0041 §1). A
 * published version is never changed again: editing opens a new draft,
 * publishing it retires the one before. One draft and one published
 * version per kind at a time. The body is a checked document (adr/0019)
 * with `{tokens}`; `body_hash` fixes what was published.
 */
export const LegalDocument = model
  .define("legal_document", {
    id: model.id({ prefix: "ldoc" }).primaryKey(),
    kind: model.enum([...LEGAL_KINDS]),
    version: model.number(),
    status: model.enum([...LEGAL_STATUSES]).default("draft"),
    title: model.text(),
    body: model.json(),
    body_hash: model.text().nullable(),
    created_by: model.text().nullable(),
    published_at: model.dateTime().nullable(),
    published_by: model.text().nullable(),
  })
  .indexes([
    { on: ["kind", "version"], unique: true, where: "deleted_at IS NULL" },
    // Named: two unique indexes on `kind` would otherwise share one generated name
    {
      name: "IDX_legal_document_one_draft",
      on: ["kind"],
      unique: true,
      where: "status = 'draft' AND deleted_at IS NULL",
    },
    {
      name: "IDX_legal_document_one_published",
      on: ["kind"],
      unique: true,
      where: "status = 'published' AND deleted_at IS NULL",
    },
  ])
