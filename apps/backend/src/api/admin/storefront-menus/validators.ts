import type { z } from "@medusajs/framework/zod"
import { menuInput } from "../../../lib/storefront/menus"

/** A storefront menu with its links (adr/0049); the same body creates or replaces one. */
export const AdminPostStorefrontMenu = menuInput
export type AdminPostStorefrontMenuType = z.output<typeof AdminPostStorefrontMenu>
