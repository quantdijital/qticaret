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
  logo_light_url: string | null
  logo_dark_url: string | null
}

// A logo lives in our own storage (https) or under this host; never a
// script-capable or inline source
const isLogoUrl = (value: string): boolean =>
  value.length <= MAX_URL_LENGTH &&
  isCleanText(value) &&
  (value.startsWith("https://") || (value.startsWith("/") && !value.startsWith("//")))

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
    logo_light_url: logoUrl,
    logo_dark_url: logoUrl,
  },
  {
    brand_color: "#2f6feb",
    radius: "soft",
    density: "comfortable",
    mode: "system",
    logo_light_url: null,
    logo_dark_url: null,
  }
)
