import { model } from "@medusajs/framework/utils"

/**
 * The storefront's design as the shop lays it out in the theme editor
 * (adr/0049): the header's, the home page's and the footer's sections in
 * one document. Staff edit the draft (saved as they go); publishing copies
 * it to `published`, numbers it and keeps it as a revision. One per shop;
 * never published, the backend's default (today's storefront) shows.
 */
export const StorefrontLayout = model.define("storefront_layout", {
  id: model.id({ prefix: "sfl" }).primaryKey(),
  /** The document as checked by `lib/storefront/layout`. */
  draft: model.json(),
  published: model.json().nullable(),
  published_at: model.dateTime().nullable(),
  /** The staff user who published it. */
  published_by: model.text().nullable(),
  /** How many times it was published: the latest revision's number. */
  revision: model.number().default(0),
})
