import { z } from "@medusajs/framework/zod"
import { MENU_LIMITS, menuInput } from "./menus"
import type { MenuInput } from "./menus"

/**
 * A menu set waiting in the design (adr/0063 §3): the menus that replace
 * the shop's when the design is published. The live menus stay the
 * storefront-menus module's (the Menüler screen writes them at once,
 * adr/0049 §3); the design carries a set only to show it in the preview
 * and to put it live with the publication, which then clears it from the
 * draft. Null: the design leaves the menus alone.
 */

/** As many menus as the module takes: one header menu, one row of top links, the footer columns. */
export const MENU_SET_LIMIT = 2 + MENU_LIMITS.footers

export const menuSet = z
  .array(menuInput)
  .max(MENU_SET_LIMIT)
  .superRefine((menus, ctx) => {
    const count = (location: MenuInput["location"]) =>
      menus.filter((menu) => menu.location === location).length
    // The same places the Menüler screen keeps free (`checkMenuStep`)
    if (count("main") > 1 || count("top") > 1) {
      ctx.addIssue({ code: "custom", message: "storefront_menus.location_taken" })
    }
    if (count("footer") > MENU_LIMITS.footers) {
      ctx.addIssue({ code: "custom", message: "storefront_menus.too_many_footers" })
    }
  })

export type MenuSet = z.infer<typeof menuSet>
