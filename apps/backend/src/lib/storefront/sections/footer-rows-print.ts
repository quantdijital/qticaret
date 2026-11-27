import { renderDoc } from "../../content"
import type { ContentDoc } from "../../content"
import type { MenuLinkInput } from "../menus"
import type { FooterBlock } from "./footer-blocks"
import type { FooterFreeRows } from "./main-footer"

/**
 * The `free_rows` footer as the storefront draws it (adr/0070 §2.2): the
 * variant's own settings and its rows, all of them. A block hidden, or
 * not valid at this moment (a picture gone from the media library), is
 * left out; its column stays, empty if it must, so the row's split holds.
 * A text block's document is the backend's HTML, a picture comes with its
 * sizes, a picture's link placed as its record is now (a broken one null:
 * the picture stays, linked nowhere). Each block carries `at`, its place
 * in the design (row by row, column by column, hidden ones counted): the
 * editor bridge's field key.
 */

/** A picture as the media library knows it. */
export interface PrintedImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: unknown
}

/** What the rows are printed with: the shop's details, the library's pictures, the links as they are now. */
export interface FooterRowTools<L> {
  /** A plain line with the shop's details in place. */
  fill: (text: string | null) => string | null
  /** A text block's document with the shop's details in place. */
  doc: (body: ContentDoc) => ContentDoc
  /** The library's picture at the address; null: not there (any more). */
  picture: (url: string) => PrintedImage | null
  resolve: (link: MenuLinkInput) => L | null
}

/** Without a library or the shop's details at hand (a unit test, a plain reading): as written. */
export const plainRowTools = <L>(
  resolve: (link: MenuLinkInput) => L | null
): FooterRowTools<L> => ({
  fill: (text) => text,
  doc: (body) => body,
  picture: (url) => ({ url, alt: null, width: null, height: null, derivatives: null }),
  resolve,
})

/** A block's own fields as printed; null: not drawn now. */
function printedBlock<L>(block: FooterBlock, tools: FooterRowTools<L>) {
  switch (block.type) {
    case "text":
      return {
        type: block.type,
        title: block.title,
        html: renderDoc(tools.doc(block.body)),
        style: block.style,
      }
    case "menu":
      return {
        type: block.type,
        slot: block.slot,
        title: block.title,
        collapse_phone: block.collapse_phone,
      }
    case "brand":
      return {
        type: block.type,
        logo: block.logo,
        logo_size: block.logo_size,
        about: block.about,
        social: block.social,
        address: block.address,
      }
    case "newsletter":
      return {
        type: block.type,
        title: block.title,
        text: tools.fill(block.text),
        description: tools.fill(block.description),
        variant: block.variant,
        ...(block.consent_style === "line" ? { consent_style: "line" as const } : {}),
      }
    case "contact":
      return {
        type: block.type,
        title: block.title,
        address: block.address,
        phone: block.phone,
        whatsapp: block.whatsapp,
        email: block.email,
        hours: block.hours,
        icon_style: block.icon_style,
      }
    case "social":
      return { type: block.type, title: block.title }
    case "payments":
      return { type: block.type, title: block.title, carriers: block.carriers }
    case "image": {
      const picture = tools.picture(block.image.url)
      return picture
        ? {
            type: block.type,
            // The block's own words stand: they name the picture where it is shown
            image: { ...picture, alt: block.image.alt },
            width: block.width,
            link: block.link ? tools.resolve(block.link) : null,
          }
        : null
    }
    case "app_badges":
      return { type: block.type, app_store: block.app_store, google_play: block.google_play }
    case "trust":
      return { type: block.type, limit: block.limit, layout: block.layout }
  }
}

/** The variant's settings and rows as `GET /store/storefront-layout`'s `main.footer_bar` carries them. */
export function footerRowsOf<L>(footer: FooterFreeRows, tools: FooterRowTools<L>) {
  let at = 0
  const rows = footer.rows.map((row) => ({
    id: row.id,
    layout: row.layout,
    ground: row.ground,
    space: row.space,
    align: row.align,
    phone_columns: row.phone_columns,
    divider: row.divider,
    columns: row.columns.map((column) => ({
      blocks: column.blocks.flatMap((block) => {
        const place = at
        at += 1
        const printed = block.visible ? printedBlock(block, tools) : null
        return printed ? [{ id: block.id, at: place, device: block.device, ...printed }] : []
      }),
    })),
  }))
  return {
    ground: footer.ground,
    badge_style: footer.badge_style,
    legal_place: footer.legal_place,
    bottom_badges: footer.bottom_badges,
    rows,
  }
}

/** The pictures the rows' shown blocks draw. */
export const footerRowImages = (blocks: readonly FooterBlock[]): string[] =>
  blocks.flatMap((block) => (block.type === "image" ? [block.image.url] : []))

/** The links the rows' blocks hold: a picture's. */
export const footerRowLinks = (blocks: readonly FooterBlock[]): MenuLinkInput[] =>
  blocks.flatMap((block) => (block.type === "image" && block.link ? [block.link] : []))

/** The text blocks' documents. */
export const footerRowDocs = (blocks: readonly FooterBlock[]): ContentDoc[] =>
  blocks.flatMap((block) => (block.type === "text" ? [block.body] : []))
