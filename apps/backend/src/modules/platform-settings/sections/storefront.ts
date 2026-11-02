import { z } from "@medusajs/framework/zod"
import { isHttpsUrl } from "../../../lib/security/https-url"
import { unknownShopTokens } from "../../../lib/shop/tokens"
import { defineSection, isCleanText } from "./define"

const MAX_PATH_LENGTH = 512

/** The icons a promise in the storefront's trust strip may carry (docs/19 §4). */
export const TRUST_ICONS = [
  "truck",
  "clock",
  "shield",
  "card",
  "refresh",
  "award",
  "gift",
  "phone",
] as const
export type TrustIcon = (typeof TRUST_ICONS)[number]

export interface StorefrontLink {
  label: string
  /** A path on the shop (`/hakkimizda`) or an https address. */
  href: string
}

/**
 * The storefront's frame as the shop writes it (F18 D3). Its menus, top
 * links and footer columns are menus of their own since adr/0049.
 */
export interface StorefrontSettings {
  /** The lines the announcement bar shows in turn (free shipping, same-day dispatch…). */
  announcements: string[]
  /** The shop's promises under the header and beside "add to cart". */
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  /** The storefront's main colour (`#rrggbb`, lower case); none: the theme's own. */
  primary_color: string | null
  /** The home page's opening; none: the shop's name and its first two categories. */
  hero: StorefrontHero | null
  /** The shop page that carries the contact form below its text (adr/0047); none: no form. */
  contact_form_path: string | null
  /**
   * The shop's colour names and their colours (F18 D5): an option value or
   * a filter value that reads as one of these names shows as a swatch.
   */
  color_swatches: { label: string; hex: string }[]
}

export interface StorefrontHero {
  /** A short line above the heading ("Yatağan el işçiliği"). */
  eyebrow: string | null
  heading: string
  text: string | null
  /** At most two: the first is the main button. None: the first two categories. */
  links: StorefrontLink[]
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => isCleanText(value), { message: "platform_settings.text_invalid" })

const isShopPath = (value: string): boolean =>
  value.length <= MAX_PATH_LENGTH &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !/\s/.test(value)

// A link opens a page of the shop or an https address, never a script
// (`javascript:`), another scheme or a protocol-relative host
const href = z
  .string()
  .trim()
  .refine((value) => isCleanText(value) && (isShopPath(value) || isHttpsUrl(value)), {
    message: "platform_settings.url_invalid",
  })

const link = z.object({ label: text(60), href }).strict()

// A line that may stand in for the shop's details (`{ücretsiz_kargo_eşiği}`, adr/0048)
const shopText = (max: number) =>
  text(max).refine((value) => unknownShopTokens(value).length === 0, {
    message: "platform_settings.token_unknown",
  })

const HEX_COLOR = /^#[0-9a-f]{6}$/

/** The storefront's frame, as the shop writes it (F18 D3, docs/19 §4). */
export const storefrontSection = defineSection<StorefrontSettings>(
  "storefront",
  {
    announcements: z.array(shopText(120)).max(5),
    trust_badges: z
      .array(
        z
          .object({ icon: z.enum(TRUST_ICONS), title: shopText(40), text: shopText(80).nullable() })
          .strict()
      )
      .max(4),
    primary_color: z
      .string()
      .trim()
      .toLowerCase()
      .regex(HEX_COLOR, { message: "platform_settings.color_invalid" })
      .nullable(),
    hero: z
      .object({
        eyebrow: shopText(40).nullable(),
        heading: shopText(90),
        text: shopText(240).nullable(),
        links: z.array(link).max(2),
      })
      .strict()
      .nullable(),
    color_swatches: z
      .array(
        z
          .object({
            label: text(40),
            hex: z
              .string()
              .trim()
              .toLowerCase()
              .regex(HEX_COLOR, { message: "platform_settings.color_invalid" }),
          })
          .strict()
      )
      .max(100)
      .refine(
        (swatches) =>
          new Set(swatches.map((swatch) => swatch.label.toLocaleLowerCase("tr"))).size ===
          swatches.length,
        { message: "platform_settings.color_duplicate" }
      ),
    contact_form_path: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => isCleanText(value) && isShopPath(value) && value !== "/", {
        message: "platform_settings.url_invalid",
      })
      .nullable(),
  },
  {
    announcements: [],
    trust_badges: [],
    primary_color: null,
    hero: null,
    contact_form_path: "/iletisim",
    color_swatches: [],
  }
)
