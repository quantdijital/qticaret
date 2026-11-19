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
  /**
   * The content page that carries the contact form below its text
   * (adr/0047), by its id: a page whose address changes keeps the form.
   * None: the old path below names it, if it does; else no form.
   */
  contact_page_id: string | null
  /**
   * The content page about the shop's ways to pay: beside its text the
   * storefront shows the ways the shop offers now and the card families'
   * installment rates (adr/0046 Ek 2026-11-05). None: as `contact_page_id`.
   */
  payment_page_id: string | null
  /** The content page about shipping: its carriers and promises beside the text. */
  shipping_page_id: string | null
  /**
   * The roles by path, from before the ids (adr/0073 Açık kararlar 3): read
   * only while the role's id is none, as the page at that address. A save
   * that names the role writes none here (`lib/storefront/page-roles.ts`).
   */
  contact_form_path: string | null
  payment_info_path: string | null
  shipping_info_path: string | null
  /**
   * The shop's colour names and their colours (F18 D5): an option value or
   * a filter value that reads as one of these names shows as a swatch.
   */
  color_swatches: { label: string; hex: string }[]
  /**
   * A product card says "few left" at this many units or fewer
   * (adr/0046 Ek 2026-11-04); never the number itself. 0: never says so.
   */
  low_stock_threshold: number
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

// One of the shop's own pages (never the home page), lower-cased as paths are kept; none: no page
const pagePath = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value) => isCleanText(value) && isShopPath(value) && value !== "/", {
    message: "platform_settings.url_invalid",
  })
  .nullable()

// A content page by its id (`cnt_…`); that it is one of the shop's pages is the save's check
const pageId = z
  .string()
  .trim()
  .regex(/^cnt_[0-9A-Za-z]{1,64}$/, { message: "platform_settings.page_unknown" })
  .nullable()

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
    contact_page_id: pageId,
    payment_page_id: pageId,
    shipping_page_id: pageId,
    contact_form_path: pagePath,
    payment_info_path: pagePath,
    shipping_info_path: pagePath,
    low_stock_threshold: z.number().int().min(0).max(1000),
  },
  {
    announcements: [],
    trust_badges: [],
    primary_color: null,
    hero: null,
    contact_page_id: null,
    payment_page_id: null,
    shipping_page_id: null,
    // The addresses Turkish shops give these pages: a shop that chose none finds its pages there
    contact_form_path: "/iletisim",
    payment_info_path: "/odeme-secenekleri",
    shipping_info_path: "/kargo-ve-teslimat",
    color_swatches: [],
    low_stock_threshold: 3,
  }
)
