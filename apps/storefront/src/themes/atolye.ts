import { atolyeTheme } from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import { FONT_FILES } from "@/app/fonts"
import { DEFAULT_THEME, themeStyle } from "@/lib/views/theme"
import type { ThemeEntry } from "./entry"

/**
 * The settings the theme takes (docs/tema/yon-2026-11-05.md; owner
 * 2026-11-04): the shop's main colour (its action) and the cards' picture
 * shape. Its own counter, face, corners and pills stand whatever the panel
 * chose, so those are read as the defaults and print nothing. The defaults
 * are this look now (Grafit, adr/0062 §2); the filter goes when the theme's
 * CSS reads each setting (adr/0062 §1).
 */
export const atolyeSettings = (settings: StoreThemeSettings): StoreThemeSettings => ({
  ...settings,
  colors: {
    primary: settings.colors.primary,
    accent: null,
    background: DEFAULT_THEME.colors.background,
  },
  typography: DEFAULT_THEME.typography,
  radius: DEFAULT_THEME.radius,
  buttons: DEFAULT_THEME.buttons,
})

/** One face for everything (Manrope, variable 200–800): its `latin` file and its Turkish letters. */
const PRELOADS = [...FONT_FILES.manrope]

export const entry: ThemeEntry = {
  theme: atolyeTheme,
  fontPreloads: () => PRELOADS,
  style: (settings) => themeStyle(atolyeSettings(settings)),
}
