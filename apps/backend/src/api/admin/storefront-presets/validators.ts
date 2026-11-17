import { z } from "@medusajs/framework/zod"
import { PACK_CODE, PRESET_CODE } from "@qticaret/sector-packs"
import { designName } from "../storefront-designs/validators"

/**
 * A preset applied to the draft (adr/0063 §7): with demo records or not;
 * `save_as` keeps the draft under that name first (adr/0064 Ek 2026-11-17).
 */
export const AdminPostStorefrontPresetApply = z
  .object({ demo: z.boolean().default(false), save_as: designName.optional() })
  .strict()
export type AdminPostStorefrontPresetApplyType = z.output<typeof AdminPostStorefrontPresetApply>

/** The path's pack and preset codes, as the packages write them. */
export const presetPath = z
  .object({ pack: z.string().regex(PACK_CODE), code: z.string().regex(PRESET_CODE) })
  .strict()
