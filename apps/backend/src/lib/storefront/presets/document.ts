import { ValidationError } from "../../errors"
import { themeSection } from "../../../modules/platform-settings/sections/theme"
import type { ThemeSettings } from "../../../modules/platform-settings/sections"
import { layoutDocument } from "../layout"
import type { LayoutDocument } from "../layout"
import type { LayoutSettings } from "../layout-settings"
import type { ResolvedPreset } from "./resolve"

/** The preset a design was last given (`settings.preset`, adr/0063 §2). */
export interface AppliedPreset {
  pack: string
  code: string
  version: number
}

const fieldOf = (error: { issues: { path: PropertyKey[] }[] }, prefix: string): string => {
  const path = error.issues[0]?.path ?? []
  return [prefix, ...path.map(String)].join(".")
}

/**
 * The preset's theme settings through the theme section's own schema, its
 * contrast rule included (adr/0063 §2); a theme this build does not draw is
 * refused there too. Refused, nothing is written.
 */
export function presetTheme(raw: unknown): ThemeSettings {
  const parsed = themeSection.full.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("storefront_preset.theme_invalid", {
      field: fieldOf(parsed.error, "theme"),
    })
  }
  return parsed.data
}

/**
 * The draft a preset makes (adr/0063 §4): its sections, theme and menu set
 * in place of the draft's, the applied preset named, the shop's own trust
 * badges, colour swatches and "Az kaldı" kept as the draft has them. Held
 * to the editor's schema as a whole: one the schema refuses writes nothing.
 */
export function presetDocument(
  resolved: Pick<ResolvedPreset, "groups" | "menus">,
  theme: ThemeSettings,
  preset: AppliedPreset,
  kept: Pick<LayoutSettings, "trust_badges" | "color_swatches" | "low_stock">
): LayoutDocument {
  const parsed = layoutDocument.safeParse({
    ...resolved.groups,
    settings: {
      trust_badges: kept.trust_badges,
      color_swatches: kept.color_swatches,
      low_stock: kept.low_stock,
      theme,
      menus: resolved.menus,
      preset,
    },
  })
  if (!parsed.success) {
    throw new ValidationError("storefront_preset.layout_invalid", {
      field: fieldOf(parsed.error, "layout"),
    })
  }
  return parsed.data
}
