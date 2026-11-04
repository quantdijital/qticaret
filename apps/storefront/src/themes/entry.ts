import type { StoreThemeSettings } from "@qticaret/types"
import type { StorefrontTheme } from "@qticaret/ui"

/**
 * A theme as the storefront builds with it (adr/0057): its pages, the face
 * files a page preloads, and the shop's theme settings (adr/0053 §B) it
 * takes, as one `:root` rule for the page's nonce'd style element.
 */
export interface ThemeEntry {
  theme: StorefrontTheme
  fontPreloads: (settings: StoreThemeSettings) => string[]
  style: (settings: StoreThemeSettings) => string | null
}
