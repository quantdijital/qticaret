import { FOOTER_ROWS_DEFAULTS, FOOTER_ROWS_LIMITS as L, FOOTER_TRUST_LIMIT } from "@qticaret/types"
import type { FooterBlockType, FooterRowLayout } from "@qticaret/types"
import type {
  FooterBarSection,
  FooterBlock,
  FooterBlockOf,
  FooterNewsletter,
  FooterRow,
  FooterRowsSection,
  FooterSection,
} from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { newRow } from "./footer-rows-ops"

/**
 * The free rows footer's starting points (adr/0070 §2.4): a new block of
 * each type at its defaults, and the footer switched to "Serbest düzen"
 * filled from what it showed (`seedFooter`): the brand, the footer menus
 * and the ways to reach the shop as blocks, the newsletter box of the
 * footer group as a block in a row of its own (the section leaves the
 * group in the same step). Only the panel does this, one step "Geri al"
 * takes back; the backend never turns a saved design into another.
 */

const SHOWN = { visible: true, device: "all" } as const

/** Each type's block as "Blok ekle" adds it. */
export function newBlock<T extends FooterBlockType>(type: T, id: string): FooterBlockOf<T> {
  const blocks: { [K in FooterBlockType]: FooterBlockOf<K> } = {
    text: { id, ...SHOWN, type: "text", title: null, body: { type: "doc", content: [] } },
    menu: { id, ...SHOWN, type: "menu", slot: 1, title: null, collapse_phone: true },
    brand: { id, ...SHOWN, type: "brand", logo: true, about: null, social: false },
    newsletter: {
      id,
      ...SHOWN,
      type: "newsletter",
      title: null,
      text: null,
      description: null,
      variant: "standard",
    },
    contact: {
      id,
      ...SHOWN,
      type: "contact",
      title: null,
      address: true,
      phone: true,
      whatsapp: true,
      email: true,
      hours: true,
    },
    social: { id, ...SHOWN, type: "social", title: null },
    payments: { id, ...SHOWN, type: "payments", title: null, carriers: false },
    image: { id, ...SHOWN, type: "image", image: null, width: "medium", link: null },
    app_badges: { id, ...SHOWN, type: "app_badges", app_store: null, google_play: null },
    trust: { id, ...SHOWN, type: "trust", limit: FOOTER_TRUST_LIMIT.default, layout: "list" },
  }
  return blocks[type]
}

/** A split of `count` columns, the first wide where there are two or more. */
const LAYOUT_OF: Readonly<Record<number, FooterRowLayout>> = {
  1: "1",
  2: "2-1",
  3: "2-1-1",
  4: "2-1-1-1",
}

/** A row holding one block a column. */
function rowOf(id: string, blocks: FooterBlock[], layout?: FooterRowLayout): FooterRow {
  const row = newRow(id, layout ?? LAYOUT_OF[blocks.length] ?? "1")
  return { ...row, columns: row.columns.map((_, at) => ({ blocks: blocks.slice(at, at + 1) })) }
}

/** The footer group's newsletter box as a block: its words and its column variant. */
function newsletterBlock(section: FooterNewsletter, id: string): FooterBlock {
  return {
    ...newBlock("newsletter", id),
    visible: section.visible,
    title: section.title?.slice(0, L.newsletterTitle) ?? null,
    text: section.text?.slice(0, L.newsletterText) ?? null,
    description: section.description,
    variant: section.variant === "in_footer" ? "in_footer" : "standard",
  }
}

/** The footer menus as blocks, by their order, at most `max`. */
const menuBlocks = (count: number, max: number, newId: () => string): FooterBlock[] =>
  Array.from({ length: Math.min(count, max) }, (_, at) => ({
    ...newBlock("menu", newId()),
    slot: at + 1,
  }))

/**
 * The rows the footer starts with, from the variant it was: the brand
 * columns' brand (its line about the shop, its profiles) and up to three
 * menus, its strip's newsletter and contact above; the ledger's brand, up
 * to two menus and the contact. A newsletter box in the group sits in a
 * row of its own above.
 */
export function seedRows(
  footer: FooterBarSection,
  newsletter: FooterNewsletter | null,
  menuCount: number,
  newId: () => string
): FooterRow[] {
  const columns = footer.variant === "brand_columns" ? footer : null
  const brand = {
    ...newBlock("brand", newId()),
    about: columns?.about?.slice(0, L.about) ?? null,
    social: columns !== null,
  }
  const rows: FooterRow[] = []
  const box = newsletter ? newsletterBlock(newsletter, newId()) : null
  if (columns?.top_strip) {
    const contact = {
      ...newBlock("contact", newId()),
      address: false,
      hours: false,
    }
    rows.push(rowOf(newId(), [box ?? newBlock("newsletter", newId()), contact], "1-1"))
  } else if (box) {
    rows.push(rowOf(newId(), [box]))
  }
  rows.push(
    columns
      ? rowOf(newId(), [brand, ...menuBlocks(menuCount, 3, newId)])
      : rowOf(newId(), [brand, ...menuBlocks(menuCount, 2, newId), newBlock("contact", newId())])
  )
  return rows
}

/**
 * The footer group with its footer switched to "Serbest düzen" (adr/0070
 * §2.4): the common settings kept, the brand columns' ground and marks
 * carried over, rows filled from what it showed; the newsletter box taken
 * out of the group into its block. A footer already in free rows stays.
 */
export function seedFooter(
  group: readonly FooterSection[],
  menuCount: number,
  newId: () => string
): FooterSection[] {
  const footer = group.find((section) => section.type === "footer_bar")
  if (!footer || footer.variant === "free_rows") {
    return [...group]
  }
  const newsletter = group.find((section) => section.type === "newsletter") ?? null
  const switched = switchVariant(footer as FooterBarSection, "free_rows") as FooterRowsSection
  // The two variants name their grounds and marks alike (adr/0070 §2)
  const seeded: FooterRowsSection = {
    ...switched,
    ground: footer.variant === "brand_columns" ? footer.ground : FOOTER_ROWS_DEFAULTS.ground,
    badge_style:
      footer.variant === "brand_columns" ? footer.badge_style : FOOTER_ROWS_DEFAULTS.badge_style,
    rows: seedRows(footer, newsletter, menuCount, newId),
  }
  return group.flatMap((section): FooterSection[] =>
    section.type === "footer_bar" ? [seeded] : section === newsletter ? [] : [section]
  )
}
