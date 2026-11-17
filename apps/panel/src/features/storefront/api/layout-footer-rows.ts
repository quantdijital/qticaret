import type { JSONContent } from "@tiptap/react"
import type {
  FooterBlockType,
  FooterImageWidth,
  FooterNewsletterVariant,
  FooterRowLayout,
  FooterRowStep,
  FooterRowsStep,
  FooterTrustLayout,
} from "@qticaret/types"
import type { LayoutImage, LayoutLink } from "./layout-sections"

/**
 * The `free_rows` footer as the draft holds it (adr/0070 §2): rows of
 * columns of blocks, each block's own fields as the backend's
 * `footer-blocks.ts` takes them. The store's view of it (`at`, resolved
 * pictures and HTML) is `@qticaret/types`' `StoreFooterRow`; this is the
 * editor's.
 */

/** What every block holds besides its own fields. */
export interface FooterBlockBase {
  /** Unique in the whole design, with the sections' and the rows' ids. */
  id: string
  visible: boolean
  device: "all" | "mobile" | "desktop"
}

export interface FooterTextBlock extends FooterBlockBase {
  type: "text"
  title: string | null
  /** A content document without headings, quotes, tables, pictures or cards (`footerDoc`). */
  body: JSONContent
}

export interface FooterMenuBlock extends FooterBlockBase {
  type: "menu"
  /** The footer menu by its order on the Menüler screen, from 1. */
  slot: number
  title: string | null
  collapse_phone: boolean
}

export interface FooterBrandBlock extends FooterBlockBase {
  type: "brand"
  logo: boolean
  about: string | null
  social: boolean
  /** The shop's address (its store details) under its line. */
  address: boolean
}

export interface FooterNewsletterBlock extends FooterBlockBase {
  type: "newsletter"
  title: string | null
  /** The consent sentence, as the newsletter box's `text`. */
  text: string | null
  description: string | null
  variant: FooterNewsletterVariant
}

export interface FooterContactBlock extends FooterBlockBase {
  type: "contact"
  title: string | null
  address: boolean
  phone: boolean
  whatsapp: boolean
  email: boolean
  hours: boolean
}

export interface FooterSocialBlock extends FooterBlockBase {
  type: "social"
  title: string | null
}

export interface FooterPaymentsBlock extends FooterBlockBase {
  type: "payments"
  title: string | null
  carriers: boolean
}

export interface FooterImageBlock extends FooterBlockBase {
  type: "image"
  /** None only while the shop has not picked one yet: the draft waits (`imageRequired`). */
  image: LayoutImage | null
  width: FooterImageWidth
  link: LayoutLink | null
}

export interface FooterAppBadgesBlock extends FooterBlockBase {
  type: "app_badges"
  app_store: string | null
  google_play: string | null
}

export interface FooterTrustBlock extends FooterBlockBase {
  type: "trust"
  limit: number
  layout: FooterTrustLayout
}

export type FooterBlock =
  | FooterTextBlock
  | FooterMenuBlock
  | FooterBrandBlock
  | FooterNewsletterBlock
  | FooterContactBlock
  | FooterSocialBlock
  | FooterPaymentsBlock
  | FooterImageBlock
  | FooterAppBadgesBlock
  | FooterTrustBlock

export type FooterBlockOf<T extends FooterBlockType> = Extract<FooterBlock, { type: T }>

export interface FooterColumn {
  blocks: FooterBlock[]
}

export interface FooterRow {
  id: string
  layout: FooterRowLayout
  ground: FooterRowStep<"ground">
  space: FooterRowStep<"space">
  align: FooterRowStep<"align">
  phone_columns: FooterRowStep<"phone_columns">
  divider: boolean
  /** As many as `layout` has parts. */
  columns: FooterColumn[]
}

/** The free rows footer's own settings: kept only while the footer is drawn as it. */
export interface FooterRowsFields {
  ground: FooterRowsStep<"ground">
  badge_style: FooterRowsStep<"badge_style">
  bottom_badges: boolean
  rows: FooterRow[]
}
