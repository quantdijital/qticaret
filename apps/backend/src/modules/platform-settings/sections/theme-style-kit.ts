import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "./define"

/**
 * The style kit in the theme section (adr/0067 §1): theme-wide identity
 * steps, each a named list whose first step is the default and today's
 * drawing. Mirrors `@qticaret/types`' `STYLE_KIT` (a unit test keeps them
 * equal). `surface_style` came before the kit and stays in `theme.ts`.
 */
export const STYLE_KIT = {
  menu_style: ["filled", "underline", "plain"],
  shadow: ["float", "none"],
  chip_style: ["filled", "lined"],
  media_ground: ["well", "page"],
  density: ["airy", "balanced", "compact"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type StyleKitField = keyof typeof STYLE_KIT

/** The kit as the theme section keeps it: every field present. */
export type StyleKitSettings = { [F in StyleKitField]: (typeof STYLE_KIT)[F][number] }

const FIELDS = Object.keys(STYLE_KIT) as StyleKitField[]

/** Each field at its first step: what the theme draws with nothing chosen. */
export const STYLE_KIT_DEFAULTS: Readonly<StyleKitSettings> = {
  menu_style: "filled",
  shadow: "float",
  chip_style: "filled",
  media_ground: "well",
  density: "airy",
}

/** The kit's fields for the theme section's schema: a step on its list only. */
export const styleKitSchema = {
  menu_style: z.enum(STYLE_KIT.menu_style),
  shadow: z.enum(STYLE_KIT.shadow),
  chip_style: z.enum(STYLE_KIT.chip_style),
  media_ground: z.enum(STYLE_KIT.media_ground),
  density: z.enum(STYLE_KIT.density),
}

/**
 * Theme settings with the kit's missing fields at their defaults: a
 * design's theme or a preset written before the kit reads as it always
 * drew. A step off the list is kept, for the schema to refuse as it does
 * every other field. A settings row needs none of this: it is read over
 * the defaults.
 */
export function withStyleKitDefaults(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value
  }
  const missing = FIELDS.filter((field) => !Object.hasOwn(value, field))
  return missing.length === 0
    ? value
    : {
        ...value,
        ...Object.fromEntries(missing.map((field) => [field, STYLE_KIT_DEFAULTS[field]])),
      }
}
