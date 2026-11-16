import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../lib/security/text"
import { DESIGN_ID, DESIGN_LIMITS } from "../../../lib/storefront/designs/limits"

const NAME_INVALID = { message: "storefront_design.name_invalid" }

/** A saved look's name (adr/0064 §3): 1–60 characters of plain text, trimmed. */
export const designName = z
  .string(NAME_INVALID)
  .trim()
  .min(1, NAME_INVALID)
  .max(DESIGN_LIMITS.name, NAME_INVALID)
  .refine((value) => isCleanText(value), NAME_INVALID)

/**
 * "Bu görünümü kaydet": the draft, or a kept publication (`revision`), under
 * a name. The design itself is read on the server, never sent.
 */
export const AdminPostStorefrontDesign = z
  .object({ name: designName, revision: z.number().int().min(1).optional() })
  .strict()
export type AdminPostStorefrontDesignType = z.output<typeof AdminPostStorefrontDesign>

/** A saved look renamed (an automatic one named becomes a named one). */
export const AdminPostStorefrontDesignUpdate = z.object({ name: designName }).strict()
export type AdminPostStorefrontDesignUpdateType = z.output<typeof AdminPostStorefrontDesignUpdate>

/** A look applied to the draft; `save_as` keeps the draft under that name first. */
export const AdminPostStorefrontDesignApply = z.object({ save_as: designName.optional() }).strict()
export type AdminPostStorefrontDesignApplyType = z.output<typeof AdminPostStorefrontDesignApply>

/** The path's id; one not shaped as a look's is a look that does not exist. */
export function designIdOf(params: Record<string, string>): string {
  const id = params["id"]
  if (typeof id !== "string" || !DESIGN_ID.test(id)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_design.unknown")
  }
  return id
}
