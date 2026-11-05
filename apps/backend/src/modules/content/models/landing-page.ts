import { model } from "@medusajs/framework/utils"
import { CONTENT_STATUSES } from "./content-entry"

/** What a landing page narrows its category by: a brand, or one option of a filterable attribute. */
export const LANDING_FACETS = ["brand", "attribute"] as const

/**
 * A facet landing page (F3.16, docs/13 §7): a category and one facet given
 * an address of its own (`{category path}/{handle}`), a title, its own text
 * and a place in the sitemap. The text's fingerprint (`lib/content/
 * originality`) measures how much of it is its own against the other
 * landing pages; too little and, live, it is kept out of search
 * (docs/14 L-UNIQ-01, adr/0019 Ek 2026-11-05).
 */
export const LandingPage = model
  .define("landing_page", {
    id: model.id({ prefix: "land" }).primaryKey(),
    category_id: model.text(),
    facet_kind: model.enum([...LANDING_FACETS]),
    // The attribute's key (`malzeme`), or `marka` for a brand
    facet_key: model.text(),
    // The option's value (`paslanmaz-celik`), or the brand's id
    facet_value: model.text(),
    title: model.text(),
    handle: model.text(),
    status: model.enum([...CONTENT_STATUSES]).default("draft"),
    body: model.json(),
    body_summary: model.text().default(""),
    word_count: model.number().default(0),
    // The text's distinct five-word runs and their MinHash signature
    fingerprint_size: model.number().default(0),
    fingerprint: model.json(),
    // Its own share of text against the pages whose text went live before, 0–100
    originality: model.number().default(0),
    // When its current text went live: the first page live with a text owns it
    text_live_at: model.dateTime().nullable(),
    // A person read it through: the share of a batch read (docs/14 L-REVIEW-01)
    reviewed_at: model.dateTime().nullable(),
    published_at: model.dateTime().nullable(),
    revised_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["category_id", "handle"], unique: true, where: "deleted_at IS NULL" },
    {
      on: ["category_id", "facet_kind", "facet_key", "facet_value"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { on: ["status", "published_at"] },
  ])
