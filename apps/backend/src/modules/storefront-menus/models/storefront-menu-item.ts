import { model } from "@medusajs/framework/utils"
import { StorefrontMenu } from "./storefront-menu"

/**
 * What a menu link opens (adr/0049): a record of the shop (by its id, so
 * its name and address stay current), a legal text, one of the
 * storefront's own pages, or an address written as it is.
 */
export const MENU_LINK_KINDS = [
  "category",
  "product",
  "collection",
  "brand",
  "page",
  "post",
  "landing",
  "legal",
  "system",
  "url",
] as const

/** A link of a menu; a header menu's links may hold one level of children (`parent_id`). */
export const StorefrontMenuItem = model
  .define("storefront_menu_item", {
    id: model.id({ prefix: "smitem" }).primaryKey(),
    menu: model.belongsTo(() => StorefrontMenu, { mappedBy: "items" }),
    parent_id: model.text().nullable(),
    rank: model.number().default(0),
    /** The shop's own wording; none: the record's or page's name. */
    label: model.text().nullable(),
    kind: model.enum([...MENU_LINK_KINDS]),
    /** A record's id, a legal kind or a storefront page's key; none for `url`. */
    target: model.text().nullable(),
    /** A shop path or an https address, for `url` only. */
    url: model.text().nullable(),
  })
  .indexes([{ on: ["menu_id", "parent_id", "rank"], where: "deleted_at IS NULL" }])
