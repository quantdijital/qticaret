import { z } from "@medusajs/framework/zod"
import { PACK_CODE, PRESET_CODE } from "@qticaret/sector-packs"

/** A preset applied to the draft (adr/0063 §7): with demo records or not, nothing else. */
export const AdminPostStorefrontPresetApply = z
  .object({ demo: z.boolean().default(false) })
  .strict()
export type AdminPostStorefrontPresetApplyType = z.output<typeof AdminPostStorefrontPresetApply>

/** The path's pack and preset codes, as the packages write them. */
export const presetPath = z
  .object({ pack: z.string().regex(PACK_CODE), code: z.string().regex(PRESET_CODE) })
  .strict()
