import { z } from "@medusajs/framework/zod"
import { base } from "../layout-fields"
import {
  FOOTER_BLOCK_MAX,
  FOOTER_BLOCK_TYPES,
  FOOTER_ROWS_LIMITS,
  footerBlock,
} from "./footer-blocks"
import type { FooterBlock } from "./footer-blocks"

/**
 * The `free_rows` footer's rows (adr/0070 §2): one to six rows, each a
 * ready-made split of columns, each column a short stack of blocks
 * (`footer-blocks.ts`). A save is held to every bound, each with its own
 * answer (`storefront_layout.footer_*`); reading a stored design forgives
 * (`storedFooterRows`).
 *
 * Mirrors `@qticaret/types`' `section-footer-rows` (the backend reads no
 * runtime value from that package); a unit test keeps them equal.
 */
export { FOOTER_ROWS_LIMITS } from "./footer-blocks"

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
] as const

export type FooterRowLayout = (typeof FOOTER_ROW_LAYOUTS)[number]

export const FOOTER_ROW_SETTINGS = {
  ground: ["inherit", "page", "well", "stage", "primary"],
  space: ["none", "small", "medium", "large"],
  align: ["start", "center"],
  phone_columns: [1, 2],
} as const

export const FOOTER_ROW_DEFAULTS = {
  layout: "1-1-1",
  ground: "inherit",
  space: "medium",
  align: "start",
  phone_columns: 1,
  divider: false,
} as const

export const FOOTER_ROWS_SETTINGS = {
  ground: ["well", "page", "stage"],
  badge_style: ["card", "plain"],
} as const

export const FOOTER_ROWS_DEFAULTS = {
  ground: "well",
  badge_style: "card",
  bottom_badges: true,
} as const

const ROW_ERROR = { error: "storefront_layout.section_invalid" }
const ROWS_LIMIT = "storefront_layout.footer_rows_limit"
const BLOCKS_LIMIT = "storefront_layout.footer_blocks_limit"
const COLUMNS_MISMATCH = "storefront_layout.footer_columns_mismatch"

const L = FOOTER_ROWS_LIMITS

/** How many columns a split has: its parts. */
export const footerRowColumns = (layout: FooterRowLayout): number => layout.split("-").length

type RowSetting = keyof typeof FOOTER_ROW_SETTINGS
type RowsSetting = keyof typeof FOOTER_ROWS_SETTINGS

/** A step off its list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const rowStep = <S extends RowSetting>(setting: S) =>
  z
    .custom<(typeof FOOTER_ROW_SETTINGS)[S][number]>(
      (value) => (FOOTER_ROW_SETTINGS[setting] as readonly unknown[]).includes(value),
      ROW_ERROR
    )
    .default(FOOTER_ROW_DEFAULTS[setting])

const rowsStep = <S extends RowsSetting>(setting: S) =>
  z
    .custom<(typeof FOOTER_ROWS_SETTINGS)[S][number]>(
      (value) => (FOOTER_ROWS_SETTINGS[setting] as readonly unknown[]).includes(value),
      ROW_ERROR
    )
    .default(FOOTER_ROWS_DEFAULTS[setting])

// Each bound is a check of its own, not the array's `max`: Medusa's answer words a
// length rule itself and would drop the key
const footerColumn = z
  .object({
    blocks: z
      .array(footerBlock)
      .refine((list) => list.length <= L.perColumn, { error: BLOCKS_LIMIT })
      .default([]),
  })
  .strict()

const footerRow = z
  .object({
    /** The sections' id rule; unique in the document with theirs and the blocks' (`layout.ts`). */
    id: base.id,
    layout: z
      .custom<FooterRowLayout>(
        (value) => (FOOTER_ROW_LAYOUTS as readonly unknown[]).includes(value),
        ROW_ERROR
      )
      .default(FOOTER_ROW_DEFAULTS.layout),
    ground: rowStep("ground"),
    space: rowStep("space"),
    align: rowStep("align"),
    phone_columns: rowStep("phone_columns"),
    divider: z.boolean().default(FOOTER_ROW_DEFAULTS.divider),
    /** As many as the split's parts (four at most, the widest split's). */
    columns: z.array(footerColumn),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (row.columns.length !== footerRowColumns(row.layout)) {
      ctx.addIssue({ code: "custom", message: COLUMNS_MISMATCH, path: ["columns"] })
    }
  })

export type FooterRow = z.infer<typeof footerRow>

/** Every block of the rows, in the design's order: row by row, column by column. */
export const footerBlocksOf = (
  rows: readonly { columns: readonly { blocks: FooterBlock[] }[] }[]
) => rows.flatMap((row) => row.columns.flatMap((column) => column.blocks))

/**
 * What `free_rows` reads when its rows are missing (adr/0070 §2.4; a
 * document written by hand): the brand, the first two footer menus and
 * the shop's ways to reach it, in one row. A copy each time: a document
 * never shares its rows with another.
 */
export const footerStartRows = (): FooterRow[] => {
  const block = { visible: true, device: "all" } as const
  const menu = (slot: number) =>
    ({
      ...block,
      id: `footermenu${String(slot)}`,
      type: "menu",
      slot,
      title: null,
      collapse_phone: true,
    }) as const
  return [
    {
      id: "footerrow1",
      ...FOOTER_ROW_DEFAULTS,
      layout: "2-1-1-1",
      columns: [
        {
          blocks: [
            {
              ...block,
              id: "footerbrand",
              type: "brand",
              logo: true,
              about: null,
              social: false,
              address: false,
            },
          ],
        },
        { blocks: [menu(1)] },
        { blocks: [menu(2)] },
        {
          blocks: [
            {
              ...block,
              id: "footercontact",
              type: "contact",
              title: null,
              address: true,
              phone: true,
              whatsapp: true,
              email: true,
              hours: true,
            },
          ],
        },
      ],
    },
  ]
}

/** The rows: one to six, the footer's blocks within their bounds, each type within its own. */
const footerRows = z
  .array(footerRow)
  .superRefine((rows, ctx) => {
    if (rows.length < 1 || rows.length > L.rows) {
      ctx.addIssue({ code: "custom", message: ROWS_LIMIT })
    }
    const blocks = footerBlocksOf(rows)
    const over = FOOTER_BLOCK_TYPES.some(
      (type) => blocks.filter((block) => block.type === type).length > FOOTER_BLOCK_MAX[type]
    )
    if (blocks.length > L.blocks || over) {
      ctx.addIssue({ code: "custom", message: BLOCKS_LIMIT })
    }
  })
  .default(footerStartRows)

/** The fields the `free_rows` branch adds to the footer's own. */
export const footerRowsFields = {
  ground: rowsStep("ground"),
  badge_style: rowsStep("badge_style"),
  /** The ways to pay in the fixed bottom line. */
  bottom_badges: z.boolean().default(FOOTER_ROWS_DEFAULTS.bottom_badges),
  rows: footerRows,
}
