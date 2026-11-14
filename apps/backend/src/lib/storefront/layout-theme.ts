import { isPlainObject } from "../../modules/platform-settings/sections/define"
import {
  primaryReadable,
  themeSection,
  upgradeStoredTheme,
} from "../../modules/platform-settings/sections/theme"
import type { ThemeSettings } from "../../modules/platform-settings/sections"

/**
 * The theme's settings in the design (adr/0063 §3): colours, faces,
 * corners, cards, header and buttons, drafted, previewed, published and
 * restored with the sections. The theme section's own schema, its
 * contrast rule included. Null until the shop writes them here: readers
 * then take the `theme` settings section (adr/0053, adr/0062), so a shop
 * sees the same storefront without a migration.
 */
export const layoutTheme = themeSection.full.nullable().default(null)

/**
 * A stored design's theme read as the theme section reads its row (adr/0062
 * §4): one written without the settings' version (a script, an imported
 * preset) is read with today's meaning rather than dropped for the
 * section's. Only on reading: a save without the version is refused.
 */
export const storedTheme = (value: unknown): unknown =>
  isPlainObject(value) ? upgradeStoredTheme(value) : value

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
