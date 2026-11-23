import { z } from "@medusajs/framework/zod"
import { LAYOUT_LIMITS, layoutDocument } from "../../../lib/storefront/layout"
import { pageId } from "../../../lib/storefront/layout-pages"

/** The theme editor's draft, saved whole as staff work (adr/0049). */
export const AdminPostStorefrontLayout = z.object({ document: layoutDocument }).strict()
export type AdminPostStorefrontLayoutType = z.output<typeof AdminPostStorefrontLayout>

/** Discard and preview take no body. */
export const AdminPostStorefrontLayoutAction = z.object({}).strict()

/**
 * Publish (adr/0049): `pages_live` the content pages in draft that go
 * live with the design (adr/0073 Ek 2026-11-19 (2) K5, "Sayfayı da yayına
 * al"), each once; none by default.
 */
export const AdminPostStorefrontLayoutPublish = z
  .object({
    pages_live: z
      .array(pageId)
      .max(LAYOUT_LIMITS.pages)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "storefront_layout.page_duplicate",
      })
      .default([]),
  })
  .strict()
export type AdminPostStorefrontLayoutPublishType = z.output<typeof AdminPostStorefrontLayoutPublish>

/**
 * A revision back into the draft; `menus: false` leaves out the menu set it
 * put live (adr/0063 §3), so publishing it does not bring that day's menus back.
 */
export const AdminPostStorefrontLayoutRestore = z
  .object({ menus: z.boolean().default(true) })
  .strict()
export type AdminPostStorefrontLayoutRestoreType = z.output<typeof AdminPostStorefrontLayoutRestore>
