import { z } from "@medusajs/framework/zod"
import { layoutDocument } from "../../../lib/storefront/layout"

/** The theme editor's draft, saved whole as staff work (adr/0049). */
export const AdminPostStorefrontLayout = z.object({ document: layoutDocument }).strict()
export type AdminPostStorefrontLayoutType = z.output<typeof AdminPostStorefrontLayout>

/** Publish, discard, restore and preview take no body. */
export const AdminPostStorefrontLayoutAction = z.object({}).strict()
