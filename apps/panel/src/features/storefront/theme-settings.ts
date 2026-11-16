import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeChoices } from "@/features/storefront/api/theme"
import { STYLE_KIT_FIELDS } from "@qticaret/types"

/**
 * The theme's settings as the form and its sample hold them (adr/0053 §B):
 * a colour of the theme's own is "" (the field's empty state), the rest as
 * the draft holds it. The draft itself holds null for no colour.
 */
export interface ThemeValues extends Omit<ThemeChoices, "colors"> {
  colors: { primary: string; accent: string; background: ThemeChoices["colors"]["background"] }
}

export const themeValuesOf = (saved: ThemeChoices): ThemeValues => ({
  colors: {
    primary: saved.colors.primary ?? "",
    accent: saved.colors.accent ?? "",
    background: saved.colors.background,
  },
  typography: { ...saved.typography },
  radius: saved.radius,
  product_card: { ...saved.product_card },
  header: { ...saved.header },
  buttons: saved.buttons,
  section_spacing: saved.section_spacing,
  surface_style: saved.surface_style,
  menu_style: saved.menu_style,
  shadow: saved.shadow,
  chip_style: saved.chip_style,
  media_ground: saved.media_ground,
  density: saved.density,
})

/** Grafit as the form holds it: no colour of the shop's own, the theme's every default. */
export const GRAFIT_VALUES: ThemeValues = themeValuesOf(GRAFIT_THEME)

/** Whether the form holds Grafit already: nothing for "Grafit'e dön" to put back. */
export function isGrafit(values: ThemeValues): boolean {
  const g = GRAFIT_VALUES
  return (
    values.colors.primary === g.colors.primary &&
    values.colors.accent === g.colors.accent &&
    values.colors.background === g.colors.background &&
    values.typography.heading === g.typography.heading &&
    values.typography.body === g.typography.body &&
    values.radius === g.radius &&
    values.buttons === g.buttons &&
    values.section_spacing === g.section_spacing &&
    values.surface_style === g.surface_style &&
    STYLE_KIT_FIELDS.every((field) => values[field] === g[field]) &&
    (Object.keys(g.product_card) as (keyof ThemeValues["product_card"])[]).every(
      (key) => values.product_card[key] === g.product_card[key]
    ) &&
    values.header.layout === g.header.layout &&
    values.header.sticky === g.header.sticky
  )
}
