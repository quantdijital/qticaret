import {
  FOOTER_IMAGE_WIDTHS,
  FOOTER_NEWSLETTER_VARIANTS,
  FOOTER_ROW_LAYOUTS,
  FOOTER_ROW_SETTINGS,
  FOOTER_TRUST_LAYOUTS,
  SECTION_DEVICES,
} from "@qticaret/types"
import type { FooterBlockType } from "@qticaret/types"
import type { AnySection, FooterBlock, FooterRowsSection } from "@/features/storefront/api/layout"
import type { FieldGroupName, RegistryField } from "../forms/field-registry"
import { placeOf } from "../forms/preview-lists"
import { allBlocks } from "./footer-rows-ops"

/**
 * The free rows footer's fields (adr/0070 §6, §7): their element ids,
 * their panel groups, the settings search's entries and the preview's
 * keys (`blocks.<at>.<field>`, `rows.<n>`), from one list, as
 * `card-field-ids.ts` does for the footer's own settings. A row or a block
 * opens its own panel (`part`); its fields stand in "İçerik", "Stil" and
 * "Gelişmiş" as a section's do (`panel-groups.ts`).
 */

export const FR = "storefront.editor.footerRows"

/** A row's or a block's own panel, beside the footer's. */
export type FooterPart = { kind: "row"; id: string } | { kind: "block"; id: string }

export const ROW_FIELDS = [
  "layout",
  "ground",
  "space",
  "align",
  "divider",
  "phone_columns",
] as const
export type RowField = (typeof ROW_FIELDS)[number]

/** A row's settings by group: its split under "İçerik", its look and its phone under "Stil". */
export const ROW_GROUPS = {
  layout: "columns",
  ground: "appearance",
  space: "appearance",
  align: "appearance",
  divider: "appearance",
  phone_columns: "phone",
} as const satisfies Record<RowField, FieldGroupName>

/** Each block type's own fields, in its form's order. */
export const BLOCK_FIELDS = {
  text: ["title", "body"],
  menu: ["slot", "title", "collapse_phone"],
  brand: ["logo", "about", "address", "social"],
  newsletter: ["title", "description", "text", "variant"],
  contact: ["title", "address", "phone", "whatsapp", "email", "hours"],
  social: ["title"],
  payments: ["title", "carriers"],
  image: ["image", "link", "width"],
  app_badges: ["app_store", "google_play"],
  trust: ["limit", "layout"],
} as const satisfies Record<FooterBlockType, readonly string[]>

/** What every block has, under "Gelişmiş". */
export const COMMON_FIELDS = ["visible", "device"] as const

export type BlockField =
  (typeof BLOCK_FIELDS)[FooterBlockType][number] | (typeof COMMON_FIELDS)[number]

/** Where a block's field stands: its words under "İçerik", how it is drawn under "Stil". */
const STYLE_GROUPS: Partial<Record<BlockField, FieldGroupName>> = {
  variant: "variant",
  width: "appearance",
  layout: "appearance",
  collapse_phone: "phone",
  visible: "visibility",
  device: "visibility",
}

export const blockGroup = (field: BlockField): FieldGroupName => STYLE_GROUPS[field] ?? "content"

export const FOOTER_ROWS_FIELD_IDS = {
  row: (rowId: string, field: RowField) => `${rowId}-row-${field}`,
  block: (blockId: string, field: BlockField) => `${blockId}-block-${field}`,
} as const

/** A block's fields, its own then the common ones. */
export const fieldsOfBlock = (block: FooterBlock): readonly BlockField[] => [
  ...BLOCK_FIELDS[block.type],
  ...COMMON_FIELDS,
]

/** A field's everyday name and term (i18n keys). */
export const blockLabel = (field: BlockField) => ({
  label: `${FR}.fields.${field}.label`,
  term: `${FR}.fields.${field}.term`,
})

/** The steps a field offers, as the search finds them by name. */
function blockOptions(field: BlockField): readonly string[] {
  const steps: Partial<Record<BlockField, readonly string[]>> = {
    variant: FOOTER_NEWSLETTER_VARIANTS,
    width: FOOTER_IMAGE_WIDTHS,
    layout: FOOTER_TRUST_LAYOUTS,
    device: SECTION_DEVICES,
  }
  return (steps[field] ?? []).map((step) => `${FR}.fields.${field}.${step}`)
}

function rowOptions(field: RowField): readonly string[] {
  const steps: Partial<Record<RowField, readonly (string | number)[]>> = {
    ...FOOTER_ROW_SETTINGS,
    layout: FOOTER_ROW_LAYOUTS,
  }
  return field === "layout"
    ? []
    : (steps[field] ?? []).map((step) => `${FR}.row.${field}.${String(step)}`)
}

/** The search's entries for the footer's rows and blocks: each opens its own panel at the field. */
export function footerRowsFields(section: AnySection): (RegistryField & { part: FooterPart })[] {
  if (section.type !== "footer_bar" || section.variant !== "free_rows") {
    return []
  }
  const rows = section.rows.flatMap((row) =>
    ROW_FIELDS.map((field) => ({
      key: `rows.${row.id}.${field}`,
      group: ROW_GROUPS[field],
      label: `${FR}.row.${field}.label`,
      term: `${FR}.row.${field}.term`,
      options: rowOptions(field),
      target: FOOTER_ROWS_FIELD_IDS.row(row.id, field),
      part: { kind: "row" as const, id: row.id },
    }))
  )
  const blocks = allBlocks(section.rows).flatMap((block) =>
    fieldsOfBlock(block).map((field) => ({
      key: `blocks.${block.id}.${field}`,
      group: blockGroup(field),
      ...blockLabel(field),
      options: blockOptions(field),
      target: FOOTER_ROWS_FIELD_IDS.block(block.id, field),
      part: { kind: "block" as const, id: block.id },
    }))
  )
  return [...rows, ...blocks]
}

/** A place the preview named in the footer: its row's or block's panel, at the field if one. */
export interface FooterPreviewField {
  target: string
  group: FieldGroupName
  part: FooterPart
}

/**
 * The preview's key for a part of the free rows footer (adr/0070 §6):
 * `blocks.<at>` a block's box (its first field), `blocks.<at>.<field>` its
 * field, `rows.<n>` a row (its split). Matched part by part against the
 * footer's own blocks and fields; anything else is null.
 */
export function footerPreviewField(
  section: FooterRowsSection,
  parts: readonly string[]
): FooterPreviewField | null {
  const [name, place, field, ...rest] = parts
  if (rest.length > 0) {
    return null
  }
  if (name === "rows" && field === undefined) {
    const at = placeOf(place, section.rows.length)
    const row = at === null ? undefined : section.rows[at]
    return row
      ? {
          target: FOOTER_ROWS_FIELD_IDS.row(row.id, "layout"),
          group: ROW_GROUPS.layout,
          part: { kind: "row", id: row.id },
        }
      : null
  }
  if (name !== "blocks") {
    return null
  }
  const blocks = allBlocks(section.rows)
  const at = placeOf(place, blocks.length)
  const block = at === null ? undefined : blocks[at]
  if (!block) {
    return null
  }
  const own = fieldsOfBlock(block)
  const picked = field === undefined ? own[0] : own.find((each) => each === field)
  return picked
    ? {
        target: FOOTER_ROWS_FIELD_IDS.block(block.id, picked),
        group: blockGroup(picked),
        part: { kind: "block", id: block.id },
      }
    : null
}
