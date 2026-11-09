import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontBackground } from "@/theme/storefront"

/**
 * The storefront's theme settings (F18 D11, adr/0053; backend
 * `platform-settings/sections/theme.ts`): choices from fixed lists, no CSS
 * and no font address. Saved, they are live at once: there is no draft.
 */

/** Self-hosted faces the storefront has a loader for; names only. */
export const HEADING_FONTS = ["fraunces", "inter", "playfair", "dm-serif", "manrope"] as const
export const BODY_FONTS = ["inter", "manrope", "source-sans", "nunito"] as const
export const BACKGROUNDS = ["warm", "neutral", "cool"] as const satisfies StorefrontBackground[]
export const RADII = ["sharp", "soft", "round"] as const
export const CARD_RATIOS = ["4:5", "1:1", "3:4"] as const
export const HEADER_LAYOUTS = ["centered", "left"] as const
export const BUTTON_SHAPES = ["pill", "rounded", "square"] as const

export type HeadingFont = (typeof HEADING_FONTS)[number]
export type BodyFont = (typeof BODY_FONTS)[number]

export interface ThemeSettings {
  /** The installed theme; one today (`atolye`, adr/0057). */
  theme: "atolye"
  colors: {
    /** Buttons, links, the announcement bar (`#rrggbb`); none: the storefront's old main colour, then the theme's ink. */
    primary: string | null
    /** Badges and highlights; none: the theme's own. Not contrast-checked. */
    accent: string | null
    background: StorefrontBackground
  }
  typography: { heading: HeadingFont; body: BodyFont }
  radius: (typeof RADII)[number]
  product_card: {
    ratio: (typeof CARD_RATIOS)[number]
    show_brand: boolean
    show_rating: boolean
  }
  header: { layout: (typeof HEADER_LAYOUTS)[number]; sticky: boolean }
  buttons: (typeof BUTTON_SHAPES)[number]
}

export const THEME_SECTION = "theme"

export const themeQuery = () => sectionQuery<ThemeSettings>(THEME_SECTION)

/** Whether each face is a serif: shown beside its name (`storefront.editor.theme.fonts.*`). */
export const SERIF_FONTS: ReadonlySet<HeadingFont | BodyFont> = new Set([
  "fraunces",
  "playfair",
  "dm-serif",
])
