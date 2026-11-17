import { isPlainObject } from "../../../modules/platform-settings/sections/define"
import {
  FOOTER_BLOCK_MAX,
  FOOTER_BLOCK_TYPES,
  FOOTER_ROWS_LIMITS,
  footerBlock,
} from "./footer-blocks"
import type { FooterBlockType } from "./footer-blocks"
import {
  FOOTER_ROWS_SETTINGS,
  FOOTER_ROW_DEFAULTS,
  FOOTER_ROW_LAYOUTS,
  FOOTER_ROW_SETTINGS,
  footerRowColumns,
  footerStartRows,
} from "./footer-rows"
import type { FooterRowLayout } from "./footer-rows"

/**
 * A stored `free_rows` footer read forgivingly (adr/0049 Ek 2026-11-14
 * §2.3): whatever today's schema would refuse is left out or read as its
 * default, so a draft or what is live always reads and draws (a save is
 * still held to the schema). Two steps: `storedFooterRows` per section,
 * `storedFreeRowIds` over the whole document (the ids are the document's).
 */

const L = FOOTER_ROWS_LIMITS
const ID = /^[a-z0-9]{6,24}$/

const isBlockType = (type: unknown): type is FooterBlockType =>
  (FOOTER_BLOCK_TYPES as readonly unknown[]).includes(type)

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/** The value when on its list, else the default. */
const onList = <T>(value: unknown, list: readonly T[], fallback: T): T =>
  (list as readonly unknown[]).includes(value) ? (value as T) : fallback

/**
 * A stored row rebuilt from the keys a row has: a step off its list reads
 * as a new row's, a field a row does not have is dropped; null: its id is
 * not one (the row is left out).
 */
function storedRow(row: Record<string, unknown>, keeps: (block: unknown) => boolean) {
  const id = row["id"]
  if (typeof id !== "string" || !ID.test(id)) {
    return null
  }
  const D = FOOTER_ROW_DEFAULTS
  const layout: FooterRowLayout = onList(row["layout"], FOOTER_ROW_LAYOUTS, D.layout)
  const stored = listOf(row["columns"])
  const columns = Array.from({ length: footerRowColumns(layout) }, (_, index) => {
    const column = stored[index]
    const kept: unknown[] = []
    for (const block of isPlainObject(column) ? listOf(column["blocks"]) : []) {
      if (kept.length < L.perColumn && keeps(block)) {
        kept.push(block)
      }
    }
    return { blocks: kept }
  })
  return {
    id,
    layout,
    ground: onList(row["ground"], FOOTER_ROW_SETTINGS.ground, D.ground),
    space: onList(row["space"], FOOTER_ROW_SETTINGS.space, D.space),
    align: onList(row["align"], FOOTER_ROW_SETTINGS.align, D.align),
    phone_columns: onList(row["phone_columns"], FOOTER_ROW_SETTINGS.phone_columns, D.phone_columns),
    divider: typeof row["divider"] === "boolean" ? row["divider"] : D.divider,
    columns,
  }
}

/**
 * A stored `free_rows` footer as today's schema reads it: a block it does
 * not read (a type off the list, a newer build's field, a step out of its
 * range) is left out, and so is whatever stands past a bound (a seventh
 * row, a column's seventh block, a type's or the footer's blocks past
 * their count) and a row whose id is not one; a row's steps off their
 * lists read as a new row's, its columns cut or filled to its split; the
 * variant's ground, marks style and bottom marks off their lists read as
 * the defaults. No row left, or rows that are no list: the starting row.
 */
export function storedFooterRows(section: Record<string, unknown>): Record<string, unknown> {
  if (section["type"] !== "footer_bar" || section["variant"] !== "free_rows") {
    return section
  }
  const off = (key: string): boolean => {
    const value = section[key]
    if (value === undefined) {
      return false
    }
    if (key === "ground" || key === "badge_style") {
      return !(FOOTER_ROWS_SETTINGS[key] as readonly unknown[]).includes(value)
    }
    return key === "bottom_badges" ? typeof value !== "boolean" : key === "rows"
  }
  // The variant's own fields off their lists, and the rows (rebuilt below), dropped
  const kept = Object.fromEntries(Object.entries(section).filter(([key]) => !off(key)))
  if (!Array.isArray(section["rows"])) {
    return kept
  }
  const counts = new Map<string, number>()
  let total = 0
  const keeps = (block: unknown): boolean => {
    if (!isPlainObject(block) || !isBlockType(block["type"]) || total >= L.blocks) {
      return false
    }
    const type = block["type"]
    const count = counts.get(type) ?? 0
    if (count >= FOOTER_BLOCK_MAX[type] || !footerBlock.safeParse(block).success) {
      return false
    }
    counts.set(type, count + 1)
    total += 1
    return true
  }
  const rows = section["rows"]
    .filter(isPlainObject)
    .flatMap((row) => {
      const read = storedRow(row, keeps)
      return read ? [read] : []
    })
    .slice(0, L.rows)
  return rows.length > 0 ? { ...kept, rows } : kept
}

/** An id like `id`, taken by nothing in `taken`: its start and a number. */
function freshId(id: string, taken: ReadonlySet<string>): string {
  for (let n = 2; ; n += 1) {
    const next = `${id.slice(0, 24 - String(n).length)}${String(n)}`
    if (!taken.has(next)) {
      return next
    }
  }
}

/**
 * A stored document's free rows footer with ids of its own: its rows' and
 * blocks' ids are the document's, so one a section already has (or a
 * starting row's fixed id beside a section that has it, or one stored
 * twice) is read under a fresh id rather than failing the whole read.
 * `sections` are every group's sections, the footer's among them, as read.
 */
export function storedFreeRowIds(sections: readonly unknown[]): unknown[] {
  const taken = new Set(
    sections.flatMap((section) =>
      isPlainObject(section) && typeof section["id"] === "string" ? [section["id"]] : []
    )
  )
  const own = (id: unknown) => {
    const name = typeof id === "string" ? id : ""
    const next = taken.has(name) ? freshId(name, taken) : name
    taken.add(next)
    return next
  }
  return sections.map((section) => {
    if (
      !isPlainObject(section) ||
      section["type"] !== "footer_bar" ||
      section["variant"] !== "free_rows"
    ) {
      return section
    }
    const rows: unknown[] = Array.isArray(section["rows"]) ? section["rows"] : footerStartRows()
    return {
      ...section,
      rows: rows.map((row) =>
        isPlainObject(row)
          ? {
              ...row,
              id: own(row["id"]),
              columns: listOf(row["columns"]).map((column) =>
                isPlainObject(column)
                  ? {
                      ...column,
                      blocks: listOf(column["blocks"]).map((block) =>
                        isPlainObject(block) ? { ...block, id: own(block["id"]) } : block
                      ),
                    }
                  : column
              ),
            }
          : row
      ),
    }
  })
}
