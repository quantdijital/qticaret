import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "../../../modules/platform-settings/sections/define"
import { LAYOUT_LIMITS, layoutDocument } from "../../../lib/storefront/layout"
import { unplacedPages } from "../../../lib/storefront/layout-pages-stored"
import { pageId } from "../../../lib/storefront/layout-pages"

/**
 * A draft from an editor that still lays a content page out above and
 * below its text (`placement`, before adr/0073 Ek 2026-11-19 (2) K1):
 * read as a stored design is, one list with the sections above the text
 * first, so an open editor's save is not refused while the panel moves
 * to one list (S7). The document itself is held to today's schema.
 */
const withoutPlaces = (value: unknown): unknown =>
  isPlainObject(value) && Array.isArray(value["pages"])
    ? { ...value, pages: unplacedPages(value["pages"]) }
    : value

/** The theme editor's draft, saved whole as staff work (adr/0049). */
export const AdminPostStorefrontLayout = z
  .object({ document: z.preprocess(withoutPlaces, layoutDocument) })
  .strict()
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
