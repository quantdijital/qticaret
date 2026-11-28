import { z } from "@medusajs/framework/zod"
import { footerDoc } from "../../content"
import { isHttpsUrl } from "../../security/https-url"
import { isCleanText } from "../../security/text"
import { base, device, image, optional, shopText, text } from "../layout-fields"
import { storefrontLink } from "../menus"
import { NEWSLETTER_CONSENT_STYLES, NEWSLETTER_LIMITS } from "./newsletter"

/**
 * The `free_rows` footer's blocks (adr/0070 §2): what a column holds, each
 * type its own `strict` branch. No HTML anywhere: a text block is a
 * narrowed content document (`footerDoc`), a picture one of the media
 * library's (checked on saving) with its words, a link the menus' link, an
 * app badge an https address on one of two hosts; every plain line is
 * clean text. A menu block names a footer menu by its order (`slot`),
 * never its id: a ready-made look rewrites the menus, the order stays.
 *
 * Mirrors `@qticaret/types`' `section-footer-rows` (the backend reads no
 * runtime value from that package); a unit test keeps them equal.
 */
export const FOOTER_BLOCK_TYPES = [
  "text",
  "menu",
  "brand",
  "newsletter",
  "contact",
  "social",
  "payments",
  "image",
  "app_badges",
  "trust",
] as const

export type FooterBlockType = (typeof FOOTER_BLOCK_TYPES)[number]

export const FOOTER_BLOCK_MAX = {
  text: 8,
  menu: 10,
  brand: 1,
  newsletter: 1,
  contact: 1,
  social: 2,
  payments: 1,
  image: 6,
  app_badges: 1,
  trust: 1,
} as const satisfies Record<FooterBlockType, number>

export const FOOTER_ROWS_LIMITS = {
  rows: 6,
  columns: 5,
  perColumn: 6,
  blocks: 24,
  title: 60,
  about: 240,
  newsletterTitle: 120,
  newsletterText: 240,
  alt: 300,
  textChars: 1500,
  textNodes: 200,
  textDepth: 4,
  slots: 10,
} as const

export const FOOTER_NEWSLETTER_VARIANTS = ["standard", "in_footer"] as const
export const FOOTER_IMAGE_WIDTHS = ["medium", "small", "full"] as const
export const FOOTER_TRUST_LAYOUTS = ["list", "inline"] as const
/** A text block's face: the theme's, or the shop's hand face (`hand`, the hero's note's). */
export const FOOTER_TEXT_STYLES = ["plain", "hand"] as const
/** The brand block's logo: the footer's usual height, or a step taller (`large`). */
export const FOOTER_LOGO_SIZES = ["medium", "large"] as const
/** The contact block's signs: in round boxes beside a small kind (`boxed`), or small in the line (`inline`). */
export const FOOTER_CONTACT_ICON_STYLES = ["boxed", "inline"] as const
export const FOOTER_TRUST_LIMIT = { min: 1, max: 4, default: 3 } as const
export const FOOTER_APP_HOSTS = {
  app_store: "apps.apple.com",
  google_play: "play.google.com",
} as const

export const BLOCK_ERROR = { error: "storefront_layout.footer_block_invalid" }

const L = FOOTER_ROWS_LIMITS

/** One of a list's named steps, its first the default (a custom check: Medusa's answer drops an enum's key). */
const step = <T extends string>(steps: readonly [T, ...T[]]) =>
  z
    .custom<T>((value) => (steps as readonly unknown[]).includes(value), BLOCK_ERROR)
    .default(steps[0])

/** A whole number within its bounds; anything else is a stale or forged editor. */
const count = (min: number, max: number) =>
  z.custom<number>(
    (value) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max,
    BLOCK_ERROR
  )

const MAX_APP_URL = 512

/** An app's page: https, exactly the store's host, no port, no credentials (`isHttpsUrl`). */
const isAppUrl = (value: unknown, host: string): boolean => {
  if (typeof value !== "string" || value.length > MAX_APP_URL) {
    return false
  }
  if (!isCleanText(value) || /\s/.test(value) || !isHttpsUrl(value)) {
    return false
  }
  const url = new URL(value)
  return url.hostname === host && url.port === ""
}

const appUrl = (host: string) =>
  optional(z.custom<string>((value) => isAppUrl(value, host), BLOCK_ERROR))

/** What every block has: its id (the sections' rule, unique in the document), shown or not, its screens. */
const common = { id: base.id, visible: base.visible, device }

const blockTitle = optional(text(L.title))

const textBlock = z
  .object({
    ...common,
    type: z.literal("text"),
    title: blockTitle,
    body: footerDoc,
    style: step(FOOTER_TEXT_STYLES),
  })
  .strict()

const menuBlock = z
  .object({
    ...common,
    type: z.literal("menu"),
    /** The footer menu by its order on the Menüler screen, from 1. */
    slot: count(1, L.slots),
    /** None: the menu's own title. */
    title: blockTitle,
    collapse_phone: z.boolean().default(true),
  })
  .strict()

const brandBlock = z
  .object({
    ...common,
    type: z.literal("brand"),
    logo: z.boolean().default(true),
    logo_size: step(FOOTER_LOGO_SIZES),
    about: optional(text(L.about)),
    social: z.boolean().default(false),
    /** The shop's address (its store details) under its line, as the brand columns draw it. */
    address: z.boolean().default(false),
  })
  .strict()

/**
 * The newsletter box in a column: the section's own fields under the same
 * names (`text` stays the consent sentence, `description` the line beside
 * the heading), the two variants that fit a column.
 */
const newsletterBlock = z
  .object({
    ...common,
    type: z.literal("newsletter"),
    title: optional(text(L.newsletterTitle)),
    text: optional(shopText(L.newsletterText)),
    description: optional(shopText(NEWSLETTER_LIMITS.description)),
    variant: step(FOOTER_NEWSLETTER_VARIANTS),
    // The box's consent setting under the same name; absent: the required box
    consent_style: z
      .custom<(typeof NEWSLETTER_CONSENT_STYLES)[number]>(
        (value) => (NEWSLETTER_CONSENT_STYLES as readonly unknown[]).includes(value),
        BLOCK_ERROR
      )
      .optional(),
  })
  .strict()

/** Which of the shop's ways to reach it show; the values are its store details' (adr/0048). */
const contactBlock = z
  .object({
    ...common,
    type: z.literal("contact"),
    title: blockTitle,
    address: z.boolean().default(true),
    phone: z.boolean().default(true),
    whatsapp: z.boolean().default(true),
    email: z.boolean().default(true),
    hours: z.boolean().default(true),
    icon_style: step(FOOTER_CONTACT_ICON_STYLES),
  })
  .strict()

const socialBlock = z.object({ ...common, type: z.literal("social"), title: blockTitle }).strict()

const paymentsBlock = z
  .object({
    ...common,
    type: z.literal("payments"),
    title: blockTitle,
    /** The carriers' marks beside the ways to pay. */
    carriers: z.boolean().default(false),
  })
  .strict()

const imageBlock = z
  .object({
    ...common,
    type: z.literal("image"),
    /** One of the media library's; its words are required (a linked picture's name). */
    image: z.object({ url: image.shape.url, alt: text(L.alt) }).strict(),
    width: step(FOOTER_IMAGE_WIDTHS),
    link: optional(storefrontLink),
  })
  .strict()

const appBadgesBlock = z
  .object({
    ...common,
    type: z.literal("app_badges"),
    app_store: appUrl(FOOTER_APP_HOSTS.app_store),
    google_play: appUrl(FOOTER_APP_HOSTS.google_play),
  })
  .strict()
  .refine((block) => block.app_store !== null || block.google_play !== null, BLOCK_ERROR)

/** The design's shared trust badges (`settings.trust_badges`): how many, and how they stand. */
const trustBlock = z
  .object({
    ...common,
    type: z.literal("trust"),
    limit: count(FOOTER_TRUST_LIMIT.min, FOOTER_TRUST_LIMIT.max).default(
      FOOTER_TRUST_LIMIT.default
    ),
    layout: step(FOOTER_TRUST_LAYOUTS),
  })
  .strict()

/** A column's block; a type off the list is a stale or forged editor. */
export const footerBlock = z.discriminatedUnion(
  "type",
  [
    textBlock,
    menuBlock,
    brandBlock,
    newsletterBlock,
    contactBlock,
    socialBlock,
    paymentsBlock,
    imageBlock,
    appBadgesBlock,
    trustBlock,
  ],
  BLOCK_ERROR
)

export type FooterBlock = z.infer<typeof footerBlock>
