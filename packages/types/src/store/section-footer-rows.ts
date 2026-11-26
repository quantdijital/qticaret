import type { StoreLayoutImage, StoreLayoutLink } from "./layout.js"

/**
 * The `free_rows` footer ("Serbest düzen", adr/0070): the shop lays its
 * footer out in rows, each row a ready-made split of columns, each column
 * a short stack of blocks. No nesting past that, no HTML: a text block is
 * a content document the backend draws, a picture one of the media
 * library's, a menu block a footer menu by its order (`slot`), never its
 * id (a ready-made look rewrites the menus, their order stays).
 *
 * The contract's lists: a new step, block type or limit goes here first,
 * then into the backend's mirrors (`lib/storefront/sections/footer-rows.ts`
 * and `footer-blocks.ts`; a test keeps them equal), then into the themes.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-footer-rows` subpath, which Turbopack resolves).
 */

/** A row's split: each part a column, its number the column's share of the width. */
export const FOOTER_ROW_LAYOUTS = [
  "1",
  "1-1",
  "2-1",
  "1-2",
  "1-1-1",
  "2-1-1",
  "1-2-1",
  "1-1-2",
  "1-1-1-1",
  "2-1-1-1",
  "2-1-1-1-1",
] as const

export type FooterRowLayout = (typeof FOOTER_ROW_LAYOUTS)[number]

/** How many columns a split has: its parts. */
export const footerRowColumns = (layout: FooterRowLayout): number => layout.split("-").length

/** A row's own named steps. */
export const FOOTER_ROW_SETTINGS = {
  /** `inherit`: the footer's ground; the others the look's names (`SECTION_LOOK.ground`). */
  ground: ["inherit", "page", "well", "stage", "primary"],
  /** The room above and below its columns (`SECTION_LOOK.space_inner`'s steps). */
  space: ["none", "small", "medium", "large"],
  align: ["start", "center"],
  /** Columns side by side on a phone. */
  phone_columns: [1, 2],
} as const satisfies Record<string, readonly [string | number, ...(string | number)[]]>

export type FooterRowSetting = keyof typeof FOOTER_ROW_SETTINGS
export type FooterRowStep<S extends FooterRowSetting> = (typeof FOOTER_ROW_SETTINGS)[S][number]

/** A new row, and what a row saved without a setting reads as. */
export const FOOTER_ROW_DEFAULTS = {
  layout: "1-1-1",
  ground: "inherit",
  space: "medium",
  align: "start",
  phone_columns: 1,
  /** A thin line above the row. */
  divider: false,
} as const satisfies { [S in FooterRowSetting]: FooterRowStep<S> } & {
  layout: FooterRowLayout
  divider: boolean
}

/** The variant's own steps: its ground and how the ways to pay stand (`brand_columns`' names). */
export const FOOTER_ROWS_SETTINGS = {
  ground: ["well", "page", "stage"],
  badge_style: ["card", "plain", "muted"],
  legal_place: ["strip", "bottom_line"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FooterRowsSetting = keyof typeof FOOTER_ROWS_SETTINGS
export type FooterRowsStep<S extends FooterRowsSetting> = (typeof FOOTER_ROWS_SETTINGS)[S][number]

/** A footer switched to `free_rows` starts with these. */
export const FOOTER_ROWS_DEFAULTS = {
  ground: "well",
  badge_style: "card",
  legal_place: "strip",
  /** The ways to pay in the fixed bottom line. */
  bottom_badges: true,
} as const satisfies { [S in FooterRowsSetting]: FooterRowsStep<S> } & { bottom_badges: boolean }

/** What a column holds. */
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

/** How many of a type the whole footer takes. */
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

/**
 * The bounds: every page draws the footer, so its rows, blocks and a text
 * block's document stay small. `slots` is the footer menus' own limit.
 */
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

/** The newsletter box's variants that fit a column; the band variants are the footer group's section's. */
export const FOOTER_NEWSLETTER_VARIANTS = ["standard", "in_footer"] as const
export type FooterNewsletterVariant = (typeof FOOTER_NEWSLETTER_VARIANTS)[number]

export const FOOTER_IMAGE_WIDTHS = ["medium", "small", "full"] as const
export type FooterImageWidth = (typeof FOOTER_IMAGE_WIDTHS)[number]

export const FOOTER_TRUST_LAYOUTS = ["list", "inline"] as const
/** A text block's face: the theme's, or the shop's hand face (`hand`, the hero's note's). */
export const FOOTER_TEXT_STYLES = ["plain", "hand"] as const
/** The brand block's logo: the footer's usual height, or a step taller (`large`). */
export const FOOTER_LOGO_SIZES = ["medium", "large"] as const
/** The contact block's signs: in round boxes beside a small kind (`boxed`), or small in the line (`inline`). */
export const FOOTER_CONTACT_ICON_STYLES = ["boxed", "inline"] as const
export type FooterContactIconStyle = (typeof FOOTER_CONTACT_ICON_STYLES)[number]
export type FooterTextStyle = (typeof FOOTER_TEXT_STYLES)[number]
export type FooterLogoSize = (typeof FOOTER_LOGO_SIZES)[number]
export type FooterTrustLayout = (typeof FOOTER_TRUST_LAYOUTS)[number]

/** The trust block's count of the design's shared badges. */
export const FOOTER_TRUST_LIMIT = { min: 1, max: 4, default: 3 } as const

/** The only hosts an app badge may point at, over https. */
export const FOOTER_APP_HOSTS = {
  app_store: "apps.apple.com",
  google_play: "play.google.com",
} as const

/**
 * What `free_rows` reads when its rows are missing (a document written by
 * hand): one row, the brand, the first two footer menus and the shop's
 * ways to reach it. The ids are fixed, so a draft and what is live read alike.
 */
export const FOOTER_ROWS_START = [
  {
    id: "footerrow1",
    ...FOOTER_ROW_DEFAULTS,
    layout: "2-1-1-1",
    columns: [
      {
        blocks: [
          {
            id: "footerbrand",
            type: "brand",
            visible: true,
            device: "all",
            logo: true,
            logo_size: "medium",
            about: null,
            social: false,
            address: false,
          },
        ],
      },
      {
        blocks: [
          {
            id: "footermenu1",
            type: "menu",
            visible: true,
            device: "all",
            slot: 1,
            title: null,
            collapse_phone: true,
          },
        ],
      },
      {
        blocks: [
          {
            id: "footermenu2",
            type: "menu",
            visible: true,
            device: "all",
            slot: 2,
            title: null,
            collapse_phone: true,
          },
        ],
      },
      {
        blocks: [
          {
            id: "footercontact",
            type: "contact",
            visible: true,
            device: "all",
            title: null,
            address: true,
            phone: true,
            whatsapp: true,
            email: true,
            hours: true,
            icon_style: "boxed",
          },
        ],
      },
    ],
  },
] as const

/** What every block prints: its id, where it stands in the design and the screens that show it. */
interface StoreFooterBlockBase {
  id: string
  /**
   * Its place in the design, counted row by row, column by column (0–23),
   * hidden blocks counted too: the editor bridge's field key (`blocks.<at>`).
   */
  at: number
  device: "all" | "mobile" | "desktop"
}

/** A block as `GET /store/storefront-layout` prints it: shown now, its text, picture and link resolved. */
export type StoreFooterBlock = StoreFooterBlockBase &
  (
    | {
        type: "text"
        title: string | null
        /** The backend's HTML (adr/0019). */
        html: string
        style: FooterTextStyle
      }
    | {
        type: "menu"
        /** The footer menu by its order, from 1; none there: not drawn. */
        slot: number
        /** None: the menu's own title. */
        title: string | null
        collapse_phone: boolean
      }
    | {
        type: "brand"
        logo: boolean
        logo_size: FooterLogoSize
        about: string | null
        social: boolean
        /** The shop's address under its line, as the brand columns draw it. */
        address: boolean
      }
    | {
        type: "newsletter"
        title: string | null
        /** The consent sentence (the newsletter box's `text`). */
        text: string | null
        description: string | null
        variant: FooterNewsletterVariant
      }
    | {
        type: "contact"
        title: string | null
        address: boolean
        phone: boolean
        whatsapp: boolean
        email: boolean
        hours: boolean
        icon_style: FooterContactIconStyle
      }
    | { type: "social"; title: string | null }
    | { type: "payments"; title: string | null; carriers: boolean }
    | {
        type: "image"
        image: StoreLayoutImage
        width: FooterImageWidth
        /** Where the picture goes; null: nowhere, or its record is gone. */
        link: StoreLayoutLink | null
      }
    | { type: "app_badges"; app_store: string | null; google_play: string | null }
    | { type: "trust"; limit: number; layout: FooterTrustLayout }
  )

/** A row as printed: its columns always as many as its split, one left empty keeps its place. */
export interface StoreFooterRow {
  id: string
  layout: FooterRowLayout
  ground: FooterRowStep<"ground">
  space: FooterRowStep<"space">
  align: FooterRowStep<"align">
  phone_columns: FooterRowStep<"phone_columns">
  divider: boolean
  columns: { blocks: StoreFooterBlock[] }[]
}

/** The `free_rows` footer's own settings as `GET /store/storefront-layout` prints them: all of them. */
export interface StoreFooterRows {
  ground: FooterRowsStep<"ground">
  badge_style: FooterRowsStep<"badge_style">
  legal_place: FooterRowsStep<"legal_place">
  bottom_badges: boolean
  rows: StoreFooterRow[]
}
