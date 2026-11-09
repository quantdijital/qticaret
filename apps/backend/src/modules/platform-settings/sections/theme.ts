import { z } from "@medusajs/framework/zod"
import { AA_LARGE_TEXT, contrastRatio } from "../../../lib/color/contrast"
import { defineSection } from "./define"

/** The storefront themes this build carries (adr/0046 §7); a new theme is a deploy. */
export const INSTALLED_THEMES = ["atolye"] as const

/**
 * The first theme's name, removed with it (adr/0057 Ek 2026-11-09): a
 * section stored before then reads as Atölye and is saved so next time.
 */
const REMOVED_THEMES: Readonly<Record<string, (typeof INSTALLED_THEMES)[number]>> = {
  base: "atolye",
}

/**
 * Self-hosted faces the storefront has a loader for: a name from this list,
 * never an address (no third-party font host sees the shop's visitors).
 */
export const HEADING_FONTS = ["fraunces", "inter", "playfair", "dm-serif", "manrope"] as const
export const BODY_FONTS = ["inter", "manrope", "source-sans", "nunito"] as const

/**
 * The page colours a theme offers, as the storefront paints them: the
 * contrast check reads these, so the storefront must use the same values
 * (adr/0053). `warm` is the first theme's bone page; Atölye paints its own
 * counter and takes only the main colour from here (adr/0057).
 */
export const THEME_BACKGROUNDS = {
  warm: "#f6f4ef",
  neutral: "#f5f5f5",
  cool: "#f3f5f8",
} as const

export type ThemeBackground = keyof typeof THEME_BACKGROUNDS

const HEX_COLOR = /^#[0-9a-f]{6}$/
const WHITE = "#ffffff"

/** How the storefront looks (F18 D11, adr/0053): choices from fixed lists, no CSS. */
export interface ThemeSettings {
  theme: (typeof INSTALLED_THEMES)[number]
  colors: {
    /**
     * Buttons, links, the announcement bar (`#rrggbb`); none: the
     * storefront section's `primary_color`, then the theme's own ink.
     */
    primary: string | null
    /** Badges and highlights; none: the theme's own. */
    accent: string | null
    background: ThemeBackground
  }
  typography: {
    heading: (typeof HEADING_FONTS)[number]
    body: (typeof BODY_FONTS)[number]
  }
  radius: "sharp" | "soft" | "round"
  product_card: { ratio: "4:5" | "1:1" | "3:4"; show_brand: boolean; show_rating: boolean }
  header: { layout: "centered" | "left"; sticky: boolean }
  buttons: "pill" | "rounded" | "square"
}

const color = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HEX_COLOR, { message: "platform_settings.color_invalid" })
  .nullable()

/**
 * Whether white text reads on the colour and the colour reads on the page:
 * WCAG AA for large text and controls, 3:1 (§1.4.3, §1.4.11).
 */
export const primaryReadable = (primary: string, background: ThemeBackground): boolean =>
  contrastRatio(primary, WHITE) >= AA_LARGE_TEXT &&
  contrastRatio(primary, THEME_BACKGROUNDS[background]) >= AA_LARGE_TEXT

export const themeSection = defineSection<ThemeSettings>(
  "theme",
  {
    theme: z.preprocess(
      (value) => (typeof value === "string" ? (REMOVED_THEMES[value] ?? value) : value),
      z.enum(INSTALLED_THEMES)
    ),
    colors: z
      .object({
        primary: color,
        accent: color,
        background: z.enum(
          Object.keys(THEME_BACKGROUNDS) as [ThemeBackground, ...ThemeBackground[]]
        ),
      })
      .strict(),
    typography: z.object({ heading: z.enum(HEADING_FONTS), body: z.enum(BODY_FONTS) }).strict(),
    radius: z.enum(["sharp", "soft", "round"]),
    product_card: z
      .object({
        ratio: z.enum(["4:5", "1:1", "3:4"]),
        show_brand: z.boolean(),
        show_rating: z.boolean(),
      })
      .strict(),
    header: z.object({ layout: z.enum(["centered", "left"]), sticky: z.boolean() }).strict(),
    buttons: z.enum(["pill", "rounded", "square"]),
  },
  // The settings' starting values, the first theme's look (adr/0053): Fraunces
  // over Inter, soft corners, 4:5 cards with the brand, the logo centred over
  // a sticky header, pill buttons. Atölye takes the main colour and the cards'
  // shape and stands its own for the rest (adr/0057)
  {
    theme: "atolye",
    colors: { primary: null, accent: null, background: "warm" },
    typography: { heading: "fraunces", body: "inter" },
    radius: "soft",
    product_card: { ratio: "4:5", show_brand: true, show_rating: false },
    header: { layout: "centered", sticky: true },
    buttons: "pill",
  },
  (values, ctx) => {
    const { primary, background } = values.colors
    // A malformed colour or page has its own issue already
    const checkable =
      typeof primary === "string" &&
      HEX_COLOR.test(primary) &&
      Object.hasOwn(THEME_BACKGROUNDS, background)
    if (checkable && !primaryReadable(primary, background)) {
      ctx.addIssue({
        code: "custom",
        message: "platform_settings.color_contrast",
        path: ["colors", "primary"],
      })
    }
  }
)
