import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "../../modules/platform-settings/sections/define"
import {
  THEME_SETTINGS_VERSION,
  primaryReadable,
  themeSection,
  withCardDefaults,
  withListingTextDefaults,
} from "../../modules/platform-settings/sections/theme"
import { withSearchFormDefaults } from "../../modules/platform-settings/sections/theme-search-form"
import type { ThemeSettings } from "../../modules/platform-settings/sections"

/**
 * The theme's settings in the design (adr/0063 §3): colours, faces,
 * corners, cards, header and buttons, drafted, previewed, published and
 * restored with the sections. The theme section's own schema, its
 * contrast rule included. Null until the shop writes them here: readers
 * then take the `theme` settings section (adr/0053, adr/0062), so a shop
 * sees the same storefront without a migration.
 */
/**
 * The accent face "none" read as left out: a design from before the face
 * holds none, and the two mean the same. One form, so choosing "none"
 * again (or a panel writing it out) is no change against what is live.
 */
export const withoutNoAccent = (value: unknown): unknown => {
  if (!isPlainObject(value)) {
    return value
  }
  const typography = value["typography"]
  if (!isPlainObject(typography) || typography["accent"] !== "none") {
    return value
  }
  return {
    ...value,
    typography: Object.fromEntries(Object.entries(typography).filter(([key]) => key !== "accent")),
  }
}

export const layoutTheme = z
  // A save from a panel before adr/0075 (adr/0077) sends no listing text (search form): defaults stand
  .preprocess(
    (value) => withoutNoAccent(withSearchFormDefaults(withListingTextDefaults(value))),
    themeSection.full
  )
  .nullable()
  .default(null)

/**
 * A stored design's theme read with today's meaning: one written without
 * the settings' version (a script, an imported preset) gets the current
 * version and is read as it stands. The design's theme has no time before
 * the version (it came after adr/0062), so the theme section's upgrade of
 * an old row (`upgradeStoredTheme`) is not for it. A card written before
 * its variant and E5 fields gets their defaults (`withCardDefaults`). Only
 * on reading: a save without them is refused.
 */
export const storedTheme = (value: unknown): unknown =>
  withCardDefaults(
    isPlainObject(value) && !Object.hasOwn(value, "settings_version")
      ? { ...value, settings_version: THEME_SETTINGS_VERSION }
      : value
  )

/** The theme as the storefront applies it: the section's version stays inside. */
export type ShownTheme = Omit<ThemeSettings, "settings_version">

const shown = (theme: ThemeSettings): ShownTheme => ({
  theme: theme.theme,
  colors: theme.colors,
  typography: theme.typography,
  radius: theme.radius,
  product_card: theme.product_card,
  header: theme.header,
  buttons: theme.buttons,
  section_spacing: theme.section_spacing,
  surface_style: theme.surface_style,
  // A category, brand or collection page's own text at its foot (adr/0075)
  listing_text: theme.listing_text,
  // The search box's fields (adr/0077 §1)
  search_form: theme.search_form,
  // The style kit (adr/0067 §1)
  menu_style: theme.menu_style,
  shadow: theme.shadow,
  chip_style: theme.chip_style,
  media_ground: theme.media_ground,
  density: theme.density,
  motion: theme.motion,
})

/**
 * The theme section as the editor opens it while the design has no theme:
 * the storefront section's old main colour folded in where the theme has
 * none (adr/0053 §B.5), only while it reads on the page. One that does not
 * would refuse every save of the draft; the theme's own ink stands in, and
 * the storefront shows it once the shop publishes.
 */
export function legacyTheme(theme: ThemeSettings, oldPrimary: string | null): ThemeSettings {
  const fold =
    theme.colors.primary === null &&
    oldPrimary !== null &&
    primaryReadable(oldPrimary, theme.colors.background)
  return fold ? { ...theme, colors: { ...theme.colors, primary: oldPrimary } } : theme
}

/**
 * The theme as applied: the design's as written; else the section's, its
 * main colour falling back to the storefront section's old one as the
 * storefront has always drawn it.
 */
export function shownTheme(
  written: ThemeSettings | null,
  theme: ThemeSettings,
  oldPrimary: string | null
): ShownTheme {
  if (written) {
    return shown(written)
  }
  return shown({
    ...theme,
    colors: { ...theme.colors, primary: theme.colors.primary ?? oldPrimary },
  })
}
