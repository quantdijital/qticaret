import { model } from "@medusajs/framework/utils"
import { StorefrontMenuItem } from "./storefront-menu-item"

/**
 * Where a menu shows on the storefront (adr/0049): the header's menu, the
 * small links above it, or a footer column (several, by rank).
 */
export const MENU_LOCATIONS = ["main", "top", "footer"] as const

/** A storefront menu (adr/0049): its links point at records, not typed addresses. */
export const StorefrontMenu = model
  .define("storefront_menu", {
    id: model.id({ prefix: "smenu" }).primaryKey(),
    title: model.text(),
    location: model.enum([...MENU_LOCATIONS]),
    /** Footer columns in this order. */
    rank: model.number().default(0),
    items: model.hasMany(() => StorefrontMenuItem, { mappedBy: "menu" }),
  })
  .cascades({ delete: ["items"] })
  .indexes([
    // One header menu and one row of top links
    { on: ["location"], unique: true, where: "location IN ('main', 'top') AND deleted_at IS NULL" },
  ])
