import { z } from "@medusajs/framework/zod"
import {
  AddonTemplateAddons,
  AddonTemplateIds,
  AddonTemplateName,
} from "../../../lib/catalog/addons"

/**
 * Add-on templates (adr/0052 Ek 2026-11-23): a name and the add-ons, as
 * a product's add-ons are checked (five at most, a paid one never
 * required), at least one. Prices are lira per unit; the cart prices on
 * the server.
 */
export const AdminPostAddonTemplate = z
  .object({ name: AddonTemplateName, addons: AddonTemplateAddons })
  .strict()
export type AdminPostAddonTemplateType = z.infer<typeof AdminPostAddonTemplate>

export const AdminUpdateAddonTemplate = z
  .object({ name: AddonTemplateName.optional(), addons: AddonTemplateAddons.optional() })
  .strict()
export type AdminUpdateAddonTemplateType = z.infer<typeof AdminUpdateAddonTemplate>

export const AdminGetAddonTemplates = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AdminGetAddonTemplatesType = z.infer<typeof AdminGetAddonTemplates>

/** The add-on templates linked to a product, the whole list. */
export const AdminPostProductAddonTemplates = z.object({ template_ids: AddonTemplateIds }).strict()
export type AdminPostProductAddonTemplatesType = z.infer<typeof AdminPostProductAddonTemplates>

/** The add-on templates an attribute template carries, in order, the whole list. */
export const AdminPostCarriedAddonTemplates = z
  .object({ addon_template_ids: AddonTemplateIds })
  .strict()
export type AdminPostCarriedAddonTemplatesType = z.infer<typeof AdminPostCarriedAddonTemplates>
