import { model } from "@medusajs/framework/utils"

export const CONTENT_KINDS = ["page", "post"] as const
export const CONTENT_STATUSES = ["draft", "published"] as const

/**
 * A content page (`/{handle}`) or blog post (`/blog/{handle}`) (F3.16,
 * adr/0019). The body is a checked document (`lib/content`), never HTML.
 * `published_at` is set the first time it goes live, `revised_at` each time
 * its title or body changes after that (the post's "updated" date).
 * The body's plain-text opening and word count are kept beside it at save,
 * so lists and search results never read the whole document.
 */
export const ContentEntry = model
  .define("content_entry", {
    id: model.id({ prefix: "cnt" }).primaryKey(),
    kind: model.enum([...CONTENT_KINDS]),
    title: model.text(),
    handle: model.text(),
    status: model.enum([...CONTENT_STATUSES]).default("draft"),
    body: model.json(),
    body_summary: model.text().default(""),
    word_count: model.number().default(0),
    // A summary of the writer's own; else the body's opening serves
    excerpt: model.text().nullable(),
    author_name: model.text().nullable(),
    // A cover image from the shop's media library
    image_url: model.text().nullable(),
    image_alt: model.text().nullable(),
    published_at: model.dateTime().nullable(),
    revised_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ["kind", "handle"], unique: true, where: "deleted_at IS NULL" },
    { on: ["kind", "status", "published_at"] },
  ])
