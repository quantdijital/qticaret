import { z } from "@medusajs/framework/zod"
import { layoutDocument } from "../../../lib/storefront/layout"

/** The theme editor's draft, saved whole as staff work (adr/0049). */
export const AdminPostStorefrontLayout = z.object({ document: layoutDocument }).strict()
export type AdminPostStorefrontLayoutType = z.output<typeof AdminPostStorefrontLayout>

/** Publish, discard and preview take no body. */
export const AdminPostStorefrontLayoutAction = z.object({}).strict()

/**
 * A revision back into the draft; `menus: false` leaves out the menu set it
 * put live (adr/0063 §3), so publishing it does not bring that day's menus back.
 */
export const AdminPostStorefrontLayoutRestore = z
  .object({ menus: z.boolean().default(true) })
  .strict()
export type AdminPostStorefrontLayoutRestoreType = z.output<typeof AdminPostStorefrontLayoutRestore>
