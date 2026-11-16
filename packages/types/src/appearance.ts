/**
 * What a shop owner chooses about the panel's look (docs/18 §5); the theme
 * engine derives everything else. Stored in the backend's `appearance`
 * settings section, whose Zod schema mirrors these values.
 */

export const THEME_RADII = ["sharp", "soft", "round"] as const
export type ThemeRadius = (typeof THEME_RADII)[number]

export const THEME_DENSITIES = ["comfortable", "compact"] as const
export type ThemeDensity = (typeof THEME_DENSITIES)[number]

export const THEME_MODES = ["light", "dark", "system"] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export const THEME_SIDEBARS = ["dark", "light", "brand"] as const
export type ThemeSidebar = (typeof THEME_SIDEBARS)[number]

/** The menu open with its labels, icons only, or icons that open it while pointed at. */
export const SIDEBAR_MODES = ["expanded", "collapsed", "auto"] as const
export type SidebarMode = (typeof SIDEBAR_MODES)[number]

export interface AppearanceSettings {
  /** `#rrggbb`, lower case. */
  brand_color: string
  radius: ThemeRadius
  density: ThemeDensity
  mode: ThemeMode
  /** The navigation's surface: ink, page-light, or the brand colour. */
  sidebar: ThemeSidebar
  /** How the menu behaves on a wide screen; a phone always opens it as a sheet. */
  sidebar_mode: SidebarMode
  logo_light_url: string | null
  logo_dark_url: string | null
  /** The storefront's site icon (a PNG from the media library); none: the storefront's own. */
  favicon_url: string | null
}

export const BRAND_COLOR_PATTERN = /^#[0-9a-f]{6}$/

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  brand_color: "#2f6feb",
  radius: "soft",
  density: "comfortable",
  mode: "system",
  sidebar: "dark",
  sidebar_mode: "expanded",
  logo_light_url: null,
  logo_dark_url: null,
  favicon_url: null,
}

/** Starting points, not themes: each goes through the engine like any colour. */
export const THEME_PRESETS: readonly { key: string; brand_color: string }[] = [
  { key: "ink", brand_color: "#2f6feb" },
  { key: "sea", brand_color: "#0f766e" },
  { key: "olive", brand_color: "#4d7c0f" },
  { key: "brick", brand_color: "#b42318" },
  { key: "saffron", brand_color: "#b45309" },
  { key: "plum", brand_color: "#6b21a8" },
]
