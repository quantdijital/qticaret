import { atolyeTheme } from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import { THEME_OWN_FONT_FILES } from "@/app/fonts"
import { DEFAULT_THEME, themeStyle } from "@/lib/views/theme"
import type { ThemeEntry } from "./entry"

/**
 * The settings Atölye takes (design.md, owner 2026-11-04): the shop's main
 * colour (its signal) and the cards' picture shape. Its own paper, faces,
 * square corners and buttons stand whatever the panel chose, so those are
 * read as the defaults and print nothing.
 */
export const atolyeSettings = (settings: StoreThemeSettings): StoreThemeSettings => ({
  ...settings,
  colors: { primary: settings.colors.primary, accent: null, background: "warm" },
  typography: DEFAULT_THEME.typography,
  radius: DEFAULT_THEME.radius,
  buttons: DEFAULT_THEME.buttons,
})

/** The body face first (the first text on a phone), its medium weight, then the display face. */
const PRELOADS = [
  ...THEME_OWN_FONT_FILES.hanken,
  ...THEME_OWN_FONT_FILES["hanken-medium"],
  ...THEME_OWN_FONT_FILES.caslon,
]

export const entry: ThemeEntry = {
  theme: atolyeTheme,
  fontPreloads: () => PRELOADS,
  style: (settings) => themeStyle(atolyeSettings(settings)),
}
