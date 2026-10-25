import { BRAND_COLOR_PATTERN, THEME_DENSITIES, THEME_MODES, THEME_RADII } from "@qticaret/types"
import { z } from "zod"

/** The appearance form's own checks, mirroring the server's; messages are i18n keys. */
export const appearanceSchema = z.object({
  brand_color: z
    .string()
    .trim()
    .toLowerCase()
    .regex(BRAND_COLOR_PATTERN, { message: "settings.appearance.errors.color" }),
  radius: z.enum(THEME_RADII),
  density: z.enum(THEME_DENSITIES),
  mode: z.enum(THEME_MODES),
})

export type AppearanceForm = z.infer<typeof appearanceSchema>
