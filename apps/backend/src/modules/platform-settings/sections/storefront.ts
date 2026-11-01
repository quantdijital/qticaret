import { z } from "@medusajs/framework/zod"
import { normalizeTrPhone } from "../../../lib/tr/phone"
import { defineSection, isCleanText } from "./define"

const MAX_PATH_LENGTH = 512
const MAX_URL_LENGTH = 2048

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

export interface StorefrontSettings {
  /** The lines the announcement bar shows in turn (free shipping, same-day dispatch…). */
  announcements: string[]
  /** The header's small links above the menu (about, contact, wholesale…). */
  top_links: StorefrontLink[]
  /** The footer's link columns; none: the storefront lists categories and legal texts. */
  footer_groups: { title: string; links: StorefrontLink[] }[]
  /** The shop's promises under the header and beside "add to cart". */
  trust_badges: { icon: TrustIcon; title: string; text: string | null }[]
  /** The number a WhatsApp chat button opens, E.164; none: no button. */
  whatsapp_phone: string | null
  /** The header's menu as the shop names it; none: the top categories and their children. */
  menu: StorefrontMenuItem[]
  /** The storefront's main colour (`#rrggbb`, lower case); none: the theme's own. */
  primary_color: string | null
  /** The home page's opening; none: the shop's name and its first two categories. */
  hero: StorefrontHero | null
  /** The shop page that carries the contact form below its text (adr/0047); none: no form. */
  contact_form_path: string | null
}

export interface StorefrontHero {
  /** A short line above the heading ("Yatağan el işçiliği"). */
  eyebrow: string | null
  heading: string
  text: string | null
  /** At most two: the first is the main button. None: the first two categories. */
  links: StorefrontLink[]
}

export interface StorefrontMenuItem extends StorefrontLink {
  /** The panel it opens: the item's own link comes first in it. */
  children: StorefrontLink[]
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

const isHttpsUrl = (value: string): boolean => {
  if (value.length > MAX_URL_LENGTH || !value.startsWith("https://")) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.username === "" && url.password === ""
  } catch {
    return false
  }
}

// A link opens a page of the shop or an https address, never a script
// (`javascript:`), another scheme or a protocol-relative host
const href = z
  .string()
  .trim()
  .refine((value) => isCleanText(value) && (isShopPath(value) || isHttpsUrl(value)), {
    message: "platform_settings.url_invalid",
  })

const link = z.object({ label: text(60), href }).strict()

const HEX_COLOR = /^#[0-9a-f]{6}$/

/** The storefront's frame, as the shop writes it (F18 D3, docs/19 §4). */
export const storefrontSection = defineSection<StorefrontSettings>(
  "storefront",
  {
    announcements: z.array(text(120)).max(5),
    top_links: z.array(link).max(8),
    footer_groups: z
      .array(z.object({ title: text(40), links: z.array(link).min(1).max(10) }).strict())
      .max(4),
    trust_badges: z
      .array(
        z.object({ icon: z.enum(TRUST_ICONS), title: text(40), text: text(80).nullable() }).strict()
      )
      .max(4),
    whatsapp_phone: z
      .string()
      .max(32)
      .nullable()
      .transform((value, ctx) => {
        if (value === null) {
          return null
        }
        const phone = normalizeTrPhone(value)
        if (!phone) {
          ctx.addIssue({ code: "custom", message: "platform_settings.phone_invalid" })
          return z.NEVER
        }
        return phone
      }),
    menu: z
      .array(z.object({ label: text(40), href, children: z.array(link).max(20) }).strict())
      .max(12),
    primary_color: z
      .string()
      .trim()
      .toLowerCase()
      .regex(HEX_COLOR, { message: "platform_settings.color_invalid" })
      .nullable(),
    hero: z
      .object({
        eyebrow: text(40).nullable(),
        heading: text(90),
        text: text(240).nullable(),
        links: z.array(link).max(2),
      })
      .strict()
      .nullable(),
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
    top_links: [],
    footer_groups: [],
    trust_badges: [],
    whatsapp_phone: null,
    menu: [],
    primary_color: null,
    hero: null,
    contact_form_path: "/iletisim",
  }
)
