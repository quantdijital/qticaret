import type { StoreFooterBlock, StoreFooterRows, StoreMenu } from "@qticaret/types"
import {
  FOOTER_CONTACT_ICON_STYLES,
  FOOTER_IMAGE_WIDTHS,
  FOOTER_LOGO_SIZES,
  FOOTER_NEWSLETTER_VARIANTS,
  FOOTER_ROW_DEFAULTS,
  FOOTER_ROW_LAYOUTS,
  FOOTER_ROW_SETTINGS,
  FOOTER_ROWS_DEFAULTS,
  FOOTER_ROWS_LIMITS,
  FOOTER_ROWS_SETTINGS,
  FOOTER_TEXT_STYLES,
  FOOTER_TRUST_LAYOUTS,
  FOOTER_TRUST_LIMIT,
  footerRowColumns,
} from "@qticaret/types/section-footer-rows"
import type {
  ContactView,
  FooterBlockView,
  FooterRowView,
  FooterRowsView,
  ImageView,
  ShopMarkView,
  SocialLinkView,
  Translate,
  TrustBadgeView,
} from "@qticaret/ui"
import type { FooterLogos } from "./footer-logo"
import { imageView } from "./image"
import { menuLink, menuLinks } from "./menus"
import { consentStyleOf, consentWordsKey } from "./newsletter"

/**
 * The free rows footer for the theme (adr/0070 §5, §2.3): the backend's
 * rows with the shop's own details put into their blocks. A menu block
 * takes the footer menu at its order (`slot`, from 1; the Menüler
 * screen's order, an empty menu counted too) and is left out when none is
 * there or it has no link; a contact, a profiles or a ways-to-pay block
 * with nothing to show is left out too; a column keeps its place. Read
 * forgivingly: a step off its list is the default, a block of a type this
 * build does not know is left out, a row's columns as many as its split.
 */

/** What the blocks are filled with: what the frame reads anyway (no request of its own). */
export interface FooterRowsParts {
  t: Translate
  /** The menus this request prints (a preview's draft set, adr/0063 §3). */
  menus: readonly StoreMenu[]
  contact: ContactView
  social: readonly SocialLinkView[]
  /** The shop's logo for each ground a row may stand on. */
  logos: FooterLogos
  name: string
  /** The shop's registered title, for the newsletter's consent sentence. */
  title: string
  trustBadges: readonly TrustBadgeView[]
  /** The ways to pay the footer names (its own list, else the providers'). */
  payments: readonly ShopMarkView[]
  carriers: readonly ShopMarkView[]
}

type Listed<T extends readonly unknown[]> = T[number]

const pick = <T extends readonly unknown[]>(list: T, value: unknown, fallback: Listed<T>) =>
  (list as readonly unknown[]).includes(value) ? (value as Listed<T>) : fallback

const words = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const on = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback

/** The variant's own settings. */
export function freeRowsOf(bar: Partial<StoreFooterRows> | null | undefined): FooterRowsView {
  return {
    ground: pick(FOOTER_ROWS_SETTINGS.ground, bar?.ground, FOOTER_ROWS_DEFAULTS.ground),
    badgeStyle: pick(
      FOOTER_ROWS_SETTINGS.badge_style,
      bar?.badge_style,
      FOOTER_ROWS_DEFAULTS.badge_style
    ),
    legalPlace: pick(
      FOOTER_ROWS_SETTINGS.legal_place,
      bar?.legal_place,
      FOOTER_ROWS_DEFAULTS.legal_place
    ),
    bottomBadges: on(bar?.bottom_badges, FOOTER_ROWS_DEFAULTS.bottom_badges),
  }
}

/** A footer menu by its order on the Menüler screen, empty ones counted. */
const footerMenuAt = (menus: readonly StoreMenu[], slot: number) =>
  menus.filter((menu) => menu.location === "footer").sort((a, b) => a.rank - b.rank)[slot - 1]

type Body = FooterBlockView extends infer B
  ? B extends FooterBlockView
    ? Omit<B, "id" | "at" | "device">
    : never
  : never

/** A saved row as read: any field may be missing or off its list. */
type RawRow = Partial<
  Record<
    "id" | "layout" | "columns" | "ground" | "space" | "align" | "phone_columns" | "divider",
    unknown
  >
>

/** A block's own fields filled in; null when the shop has nothing for it. */
function bodyOf(
  block: StoreFooterBlock,
  parts: FooterRowsParts,
  logo: ImageView | null
): Body | null {
  const title = words((block as { title?: unknown }).title)
  switch (block.type) {
    case "text": {
      const html = typeof block.html === "string" ? block.html : ""
      const style = pick(FOOTER_TEXT_STYLES, block.style, "plain")
      return html.length > 0 ? { type: "text", title, html, style } : null
    }
    case "menu": {
      const menu = Number.isInteger(block.slot) ? footerMenuAt(parts.menus, block.slot) : undefined
      const links = menu ? menuLinks(menu.items, parts.t) : []
      return menu && links.length > 0
        ? {
            type: "menu",
            title: title ?? menu.title,
            links,
            collapsePhone: on(block.collapse_phone, true),
          }
        : null
    }
    case "brand":
      return {
        type: "brand",
        logo: on(block.logo, true) ? logo : null,
        logoSize: pick(FOOTER_LOGO_SIZES, block.logo_size, "medium"),
        name: parts.name,
        about: words(block.about)?.slice(0, FOOTER_ROWS_LIMITS.about) ?? null,
        social: on(block.social, false) ? [...parts.social] : [],
        address: on(block.address, false) ? parts.contact.address : null,
      }
    case "newsletter":
      return {
        type: "newsletter",
        title: title ?? parts.t("newsletter.title"),
        consent:
          words(block.text) ??
          parts.t(consentWordsKey(consentStyleOf(block)), { shop: parts.title }),
        description: words(block.description),
        variant: pick(FOOTER_NEWSLETTER_VARIANTS, block.variant, "standard"),
        consentStyle: consentStyleOf(block),
      }
    case "contact": {
      const { contact } = parts
      const body = {
        type: "contact" as const,
        title,
        address: on(block.address, true) ? contact.address : null,
        phone: on(block.phone, true) && contact.phoneHref ? contact.phone : null,
        phoneHref: on(block.phone, true) ? contact.phoneHref : null,
        whatsappHref: on(block.whatsapp, true) ? contact.whatsappHref : null,
        email: on(block.email, true) ? contact.email : null,
        hours: on(block.hours, true) ? contact.hours : [],
        iconStyle: pick(FOOTER_CONTACT_ICON_STYLES, block.icon_style, "boxed"),
      }
      const any = [body.address, body.phone, body.whatsappHref, body.email].some(Boolean)
      return any || body.hours.length > 0 ? body : null
    }
    case "social":
      return parts.social.length > 0 ? { type: "social", title, profiles: [...parts.social] } : null
    case "payments": {
      const carriers = on(block.carriers, false) ? [...parts.carriers] : []
      return parts.payments.length > 0 || carriers.length > 0
        ? { type: "payments", title, payments: [...parts.payments], carriers }
        : null
    }
    case "image":
      return typeof (block.image as { url?: unknown } | null)?.url === "string"
        ? {
            type: "image",
            image: imageView(block.image, ""),
            width: pick(FOOTER_IMAGE_WIDTHS, block.width, "medium"),
            // The picture names the link (its alt text): the link's own words are not needed
            link: block.link
              ? menuLink(
                  { ...block.link, label: block.link.label ?? parts.name, children: [] },
                  parts.t
                )
              : null,
          }
        : null
    case "app_badges": {
      const appStore = words(block.app_store)
      const googlePlay = words(block.google_play)
      return appStore || googlePlay ? { type: "app_badges", appStore, googlePlay } : null
    }
    case "trust": {
      const limit = Number.isInteger(block.limit)
        ? Math.min(Math.max(block.limit, FOOTER_TRUST_LIMIT.min), FOOTER_TRUST_LIMIT.max)
        : FOOTER_TRUST_LIMIT.default
      const badges = parts.trustBadges.slice(0, limit)
      return badges.length > 0
        ? { type: "trust", badges, layout: pick(FOOTER_TRUST_LAYOUTS, block.layout, "list") }
        : null
    }
    default:
      return null
  }
}

function blockOf(
  raw: unknown,
  parts: FooterRowsParts,
  logo: ImageView | null
): FooterBlockView | null {
  if (typeof raw !== "object" || raw === null) {
    return null
  }
  const block = raw as StoreFooterBlock
  if (typeof block.id !== "string" || !Number.isInteger(block.at)) {
    return null
  }
  const body = bodyOf(block, parts, logo)
  return body
    ? {
        id: block.id,
        at: block.at,
        device: pick(["all", "mobile", "desktop"] as const, block.device, "all"),
        ...body,
      }
    : null
}

/** The logo for a row's ground: the stage's dark one, the main colour's as it reads, else light. */
const rowLogo = (logos: FooterLogos, ground: string, dark: boolean): ImageView | null =>
  ground === "stage" || (ground === "inherit" && dark)
    ? logos.dark
    : ground === "primary"
      ? logos.primary
      : logos.light

/**
 * The rows as the theme draws them; none printed (a backend before them):
 * none. `dark`: the footer stands on the stage, so a row on its ground
 * (`inherit`) is dark too and its brand block takes the dark-ground logo.
 */
export function footerRowsOf(rows: unknown, parts: FooterRowsParts, dark = false): FooterRowView[] {
  if (!Array.isArray(rows)) {
    return []
  }
  return rows.slice(0, FOOTER_ROWS_LIMITS.rows).flatMap((raw: unknown): FooterRowView[] => {
    if (typeof raw !== "object" || raw === null) {
      return []
    }
    const row = raw as RawRow
    const layout = pick(FOOTER_ROW_LAYOUTS, row.layout, FOOTER_ROW_DEFAULTS.layout)
    const ground = pick(FOOTER_ROW_SETTINGS.ground, row.ground, FOOTER_ROW_DEFAULTS.ground)
    const logo = rowLogo(parts.logos, ground, dark)
    const saved = Array.isArray(row.columns) ? (row.columns as unknown[]) : []
    const columns = Array.from({ length: footerRowColumns(layout) }, (_, index) => {
      const column = saved[index] as { blocks?: unknown } | undefined
      const blocks = Array.isArray(column?.blocks) ? column.blocks : []
      return {
        blocks: blocks
          .slice(0, FOOTER_ROWS_LIMITS.perColumn)
          .flatMap((block: unknown) => blockOf(block, parts, logo) ?? []),
      }
    })
    return [
      {
        id: typeof row.id === "string" ? row.id : `row${String(rows.indexOf(raw))}`,
        layout,
        ground,
        space: pick(FOOTER_ROW_SETTINGS.space, row.space, FOOTER_ROW_DEFAULTS.space),
        align: pick(FOOTER_ROW_SETTINGS.align, row.align, FOOTER_ROW_DEFAULTS.align),
        phoneColumns: pick(
          FOOTER_ROW_SETTINGS.phone_columns,
          row.phone_columns,
          FOOTER_ROW_DEFAULTS.phone_columns
        ),
        divider: on(row.divider, FOOTER_ROW_DEFAULTS.divider),
        columns,
      },
    ]
  })
}
