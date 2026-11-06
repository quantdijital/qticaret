import { model } from "@medusajs/framework/utils"

/**
 * A blog author (adr/0060): the person a post names, with a page of their
 * own at `/blog/yazar/{handle}`. Name, title, photo, short bio and links
 * are published on the storefront by the shop's choice (the person's
 * consent is the shop's to have; docs/kvkk-envanter). `user_id` ties the
 * author to a staff account when the writer is one of the team; it is
 * never shown. A post names at most one author (`content_entry.author_id`).
 */
export const ContentAuthor = model
  .define("content_author", {
    id: model.id({ prefix: "cauth" }).primaryKey(),
    name: model.text(),
    handle: model.text(),
    job_title: model.text().nullable(),
    // Plain text; a blank line separates paragraphs
    bio: model.text().nullable(),
    // A photo from the shop's media library
    image_url: model.text().nullable(),
    // The person's own pages, the structured data's `sameAs`
    website_url: model.text().nullable(),
    linkedin_url: model.text().nullable(),
    instagram_url: model.text().nullable(),
    x_url: model.text().nullable(),
    // A staff account (Medusa `user`) when the writer is one of the team
    user_id: model.text().nullable(),
  })
  .indexes([
    { on: ["handle"], unique: true, where: "deleted_at IS NULL" },
    { on: ["user_id"], where: "deleted_at IS NULL AND user_id IS NOT NULL" },
  ])
