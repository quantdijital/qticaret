import { z } from "zod"
import { isHexColor } from "@/features/settings/storefront"
import {
  BACKGROUNDS,
  BODY_FONTS,
  BUTTON_SHAPES,
  CARD_RATIOS,
  HEADER_LAYOUTS,
  HEADING_FONTS,
  RADII,
} from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { primaryReadable } from "@/theme/storefront"

/**
 * The theme settings form (adr/0053 §B): the server's lists, its colour
 * rule and its contrast check, so a refusal shows before the save.
 */

export const CONTRAST_ERROR = "storefront.editor.theme.errors.contrast"
const COLOR_ERROR = "settings.storefront.errors.colorInvalid"

// Empty: none (the theme's own); else `#rrggbb`, lower case as the server keeps it
const optionalColor = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => value === "" || isHexColor(value), COLOR_ERROR)

export const themeSchema = z
  .object({
    colors: z.object({
      primary: optionalColor,
      accent: optionalColor,
      background: z.enum(BACKGROUNDS),
    }),
    typography: z.object({ heading: z.enum(HEADING_FONTS), body: z.enum(BODY_FONTS) }),
    radius: z.enum(RADII),
    product_card: z.object({
      ratio: z.enum(CARD_RATIOS),
      show_brand: z.boolean(),
      show_rating: z.boolean(),
    }),
    header: z.object({ layout: z.enum(HEADER_LAYOUTS), sticky: z.boolean() }),
    buttons: z.enum(BUTTON_SHAPES),
  })
  .superRefine(({ colors }, ctx) => {
    if (isHexColor(colors.primary) && !primaryReadable(colors.primary, colors.background)) {
      ctx.addIssue({ code: "custom", path: ["colors", "primary"], message: CONTRAST_ERROR })
    }
  })

export type ThemeValues = z.input<typeof themeSchema>
export type ThemeParsed = z.output<typeof themeSchema>

/**
 * The stored settings as the form holds them. A main colour not yet moved
 * here shows the storefront section's old one (adr/0053 §B.5): saving moves
 * it, through the contrast check.
 */
export const themeValuesOf = (saved: ThemeSettings, legacyPrimary: string | null): ThemeValues => ({
  colors: {
    primary: saved.colors.primary ?? legacyPrimary ?? "",
    accent: saved.colors.accent ?? "",
    background: saved.colors.background,
  },
  typography: { ...saved.typography },
  radius: saved.radius,
  product_card: { ...saved.product_card },
  header: { ...saved.header },
  buttons: saved.buttons,
})

const orNull = (value: string): string | null => (value === "" ? null : value)

/** Every group as it is sent; the server keeps the theme itself. */
export const themeBodyOf = (values: ThemeParsed): Omit<ThemeSettings, "theme"> => ({
  colors: {
    primary: orNull(values.colors.primary),
    accent: orNull(values.colors.accent),
    background: values.colors.background,
  },
  typography: values.typography,
  radius: values.radius,
  product_card: values.product_card,
  header: values.header,
  buttons: values.buttons,
})

/** Whether the server refused the main colour's contrast (the key in `code`, or as the message). */
export function isContrastRefusal(error: unknown): boolean {
  const failure = error as { code?: unknown; message?: unknown } | null
  return [failure?.code, failure?.message].includes("platform_settings.color_contrast")
}
