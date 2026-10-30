import { z } from "@medusajs/framework/zod"
import { RESTRICTIONS } from "../../../lib/catalog"

/** A category's adults-only mark (F13.4): a reason, or null to clear it. */
export const AdminPostCategoryRestriction = z
  .object({ restriction: z.enum(RESTRICTIONS).nullable() })
  .strict()
export type AdminPostCategoryRestrictionType = z.infer<typeof AdminPostCategoryRestriction>
