import { z } from "@medusajs/framework/zod"
import { PACK_CODE, PRESET_CODE } from "@qticaret/sector-packs"
import { designName } from "../storefront-designs/validators"

/** What of a look the draft takes (owner's decision 2026-11-28): its style alone, or all of it. */
export const PRESET_SCOPES = ["style", "full"] as const

/**
 * A preset applied to the draft (adr/0063 §7): with demo records or not;
 * `save_as` keeps the draft under that name first (adr/0064 Ek 2026-11-17);
 * `scope`: `full` (the default, as before) its sections, menus and style,
 * `style` its theme settings alone, the draft's sections kept.
 */
export const AdminPostStorefrontPresetApply = z
  .object({
    demo: z.boolean().default(false),
    save_as: designName.optional(),
    scope: z.enum(PRESET_SCOPES).default("full"),
  })
  .strict()
export type AdminPostStorefrontPresetApplyType = z.output<typeof AdminPostStorefrontPresetApply>

/** The path's pack and preset codes, as the packages write them. */
export const presetPath = z
  .object({ pack: z.string().regex(PACK_CODE), code: z.string().regex(PRESET_CODE) })
  .strict()
