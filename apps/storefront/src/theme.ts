import { entry } from "@qticaret/storefront-theme"
import type { StorefrontTheme } from "@qticaret/ui"

/**
 * The shop's theme (adr/0046 §7), chosen when the storefront is built
 * (adr/0057, `STOREFRONT_THEME`): its pages, the face files it preloads,
 * and the shop's theme settings it applies (adr/0053 §B).
 */
export const theme: StorefrontTheme = entry.theme
export const themeFontPreloads = entry.fontPreloads
export const themeSettingsStyle = entry.style
/** The ids the theme writes fixed on a content, legal or post page (`pageAnchors`). */
export const themePageIds = entry.pageIds
