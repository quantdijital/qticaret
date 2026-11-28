import { z } from "@medusajs/framework/zod"
import { defineSection, isCleanText } from "./define"

// Mirrors packages/types `appearance.ts`; the server cannot import that ESM package
const HEX_COLOR = /^#[0-9a-f]{6}$/
const MAX_URL_LENGTH = 2048

export interface AppearanceSettings {
  /** `#rrggbb`, lower case. */
  brand_color: string
  radius: "sharp" | "soft" | "round"
  density: "comfortable" | "compact"
  mode: "light" | "dark" | "system"
  /** The navigation's surface: ink, page-light, or the brand colour. */
  sidebar: "dark" | "light" | "brand"
  /** The menu on a wide screen: open, icons only, or icons that open while pointed at. */
  sidebar_mode: "expanded" | "collapsed" | "auto"
  /** The page, cards and menus: a trace of the brand hue, grey, or a warm or cool grey. */
  surface: "brand" | "neutral" | "warm" | "cool"
  logo_light_url: string | null
  logo_dark_url: string | null
  /** The storefront's site icon (a PNG from the media library); none: the storefront's own. */
  favicon_url: string | null
}

// A logo is an address of our own storage, never a script-capable or inline source. Which
// one is the workflow's to say (`steps/brand-images.ts`: a newly chosen one must be the
// shop's upload); storage serves over http where it is local (tests, a developer's machine
// without S3), so the scheme alone is no proof either way
const isLogoUrl = (value: string): boolean =>
  value.length <= MAX_URL_LENGTH &&
  isCleanText(value) &&
  // A backslash is no part of our storage's addresses; browsers read `/\host` as `//host`
  !value.includes("\\") &&
  (value.startsWith("https://") ||
    value.startsWith("http://") ||
    (value.startsWith("/") && !value.startsWith("//")))

const logoUrl = z
  .string()
  .trim()
  .refine(isLogoUrl, { message: "platform_settings.url_invalid" })
  .nullable()

/** How the shop's panel looks (adr/0022, docs/18 §5): the theme engine derives the rest. */
export const appearanceSection = defineSection<AppearanceSettings>(
  "appearance",
  {
    brand_color: z
      .string()
      .trim()
      .toLowerCase()
      .regex(HEX_COLOR, { message: "platform_settings.color_invalid" }),
    radius: z.enum(["sharp", "soft", "round"]),
    density: z.enum(["comfortable", "compact"]),
    mode: z.enum(["light", "dark", "system"]),
    sidebar: z.enum(["dark", "light", "brand"]),
    sidebar_mode: z.enum(["expanded", "collapsed", "auto"]),
    surface: z.enum(["brand", "neutral", "warm", "cool"]),
    logo_light_url: logoUrl,
    logo_dark_url: logoUrl,
    // A PNG or a cleaned SVG of the shop's uploads: `workflows/platform-settings/steps/brand-images.ts`
    favicon_url: logoUrl,
  },
  {
    brand_color: "#2f6feb",
    radius: "soft",
    density: "comfortable",
    mode: "system",
    sidebar: "dark",
    sidebar_mode: "expanded",
    // The panel's first look: a row saved before the choice existed keeps it
    surface: "brand",
    logo_light_url: null,
    logo_dark_url: null,
    favicon_url: null,
  }
)
