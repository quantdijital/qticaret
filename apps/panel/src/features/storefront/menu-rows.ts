import { MENU_LIMITS, targetOf } from "@/features/storefront/api/menus"
import type { LinkInput, LinkTarget, Menu, MenuItemInput } from "@/features/storefront/api/menus"
import { isCleanText } from "@/features/settings/storefront"

/**
 * A menu's links as the editor holds them: one flat list in the order the
 * storefront shows them, a child (depth 1) belonging to the nearest
 * top-level row above it. Moving a row is then moving a slice of the list.
 */
export interface MenuRow {
  /** The saved link's id, or one made here for a new link. */
  key: string
  depth: 0 | 1
  to: LinkTarget
  /** As typed; empty: the record's own name. */
  label: string
  /** The record's current name, or the published legal text's title. */
  name: string | null
  path: string | null
  broken: boolean
}

export interface MenuDraft {
  title: string
  rows: MenuRow[]
}

let made = 0
/** A key for a link added here: unique on the page, never sent. */
export const newKey = (): string => `new-${String(++made)}`

/** A saved menu as the editor's draft. */
export function draftOf(menu: Menu): MenuDraft {
  return {
    title: menu.title,
    rows: menu.items.flatMap((item) =>
      [item, ...item.children].map((link, index): MenuRow => ({
        key: link.id,
        depth: index === 0 ? 0 : 1,
        to: targetOf(link),
        label: link.label ?? "",
        name: link.name,
        path: link.path,
        broken: link.broken,
      }))
    ),
  }
}

const linkOf = (row: MenuRow): LinkInput => {
  const label = row.label.trim()
  return row.to.kind === "url"
    ? { kind: "url", url: row.to.url, label }
    : { ...row.to, label: label === "" ? null : label }
}

/** The rows as the server takes them: each top-level link with its children. */
export function itemsOf(rows: readonly MenuRow[]): MenuItemInput[] {
  const items: MenuItemInput[] = []
  for (const row of rows) {
    const parent = items.at(-1)
    if (row.depth === 1 && parent) {
      parent.children.push(linkOf(row))
    } else {
      items.push({ link: linkOf(row), children: [] })
    }
  }
  return items
}

/** What a save would send: two drafts that send the same are the same. */
export const sameDraft = (a: MenuDraft, b: MenuDraft): boolean =>
  a.title.trim() === b.title.trim() &&
  JSON.stringify(itemsOf(a.rows)) === JSON.stringify(itemsOf(b.rows))

/** Where the top-level row at `index` starts its block (a child's parent). */
function blockStart(rows: readonly MenuRow[], index: number): number {
  let start = index
  while (start > 0 && rows[start]?.depth === 1) {
    start--
  }
  return start
}

/** Just past a row and, for a top-level one, its children. */
function blockEnd(rows: readonly MenuRow[], index: number): number {
  if (rows[index]?.depth === 1) {
    return index + 1
  }
  let end = index + 1
  while (rows[end]?.depth === 1) {
    end++
  }
  return end
}

/** Each child's parent, by key: the nearest top-level row above it. */
export function parentsOf(rows: readonly MenuRow[]): Map<string, string> {
  const parents = new Map<string, string>()
  let top: string | null = null
  for (const row of rows) {
    if (row.depth === 0) {
      top = row.key
    } else if (top) {
      parents.set(row.key, top)
    }
  }
  return parents
}

/** Whether the rows stay within the server's limits. */
export function fits(rows: readonly MenuRow[]): boolean {
  const items = itemsOf(rows)
  return (
    rows.length <= MENU_LIMITS.total &&
    items.length <= MENU_LIMITS.links &&
    items.every((item) => item.children.length <= MENU_LIMITS.children)
  )
}

const checked = (rows: MenuRow[] | null): MenuRow[] | null => (rows && fits(rows) ? rows : null)

/** A row one place up among its siblings, a top-level one with its children; null: it cannot. */
export function moveUp(rows: readonly MenuRow[], index: number): MenuRow[] | null {
  const row = rows[index]
  if (!row || index === 0) {
    return null
  }
  if (row.depth === 1) {
    return rows[index - 1]?.depth === 1 ? swap(rows, index - 1, index) : null
  }
  const before = blockStart(rows, index - 1)
  const end = blockEnd(rows, index)
  return [
    ...rows.slice(0, before),
    ...rows.slice(index, end),
    ...rows.slice(before, index),
    ...rows.slice(end),
  ]
}

/** A row one place down among its siblings; null: it cannot. */
export function moveDown(rows: readonly MenuRow[], index: number): MenuRow[] | null {
  const row = rows[index]
  if (!row) {
    return null
  }
  if (row.depth === 1) {
    return rows[index + 1]?.depth === 1 ? swap(rows, index, index + 1) : null
  }
  const end = blockEnd(rows, index)
  if (end >= rows.length) {
    return null
  }
  const after = blockEnd(rows, end)
  return [
    ...rows.slice(0, index),
    ...rows.slice(end, after),
    ...rows.slice(index, end),
    ...rows.slice(after),
  ]
}

function swap(rows: readonly MenuRow[], a: number, b: number): MenuRow[] {
  const next = [...rows]
  const first = next[a]
  const second = next[b]
  if (first && second) {
    next[a] = second
    next[b] = first
  }
  return next
}

/** A row taken out; a top-level one takes its children with it. */
export const removeRow = (rows: readonly MenuRow[], index: number): MenuRow[] => [
  ...rows.slice(0, index),
  ...rows.slice(blockEnd(rows, index)),
]

/** A top-level row (and its children) under the row above it; null: it cannot. */
export function indent(rows: readonly MenuRow[], index: number): MenuRow[] | null {
  const row = rows[index]
  if (!row || row.depth === 1 || index === 0) {
    return null
  }
  return checked(rows.map((each, at) => (at === index ? { ...each, depth: 1 } : each)))
}

/** A child out to the top level, right after its parent's block; null: it cannot. */
export function outdent(rows: readonly MenuRow[], index: number): MenuRow[] | null {
  const row = rows[index]
  if (!row || row.depth === 0) {
    return null
  }
  const end = blockEnd(rows, blockStart(rows, index))
  const rest = rows.filter((_, at) => at !== index)
  return checked([...rest.slice(0, end - 1), { ...row, depth: 0 }, ...rest.slice(end - 1)])
}

export type DropPlace = "before" | "after"

/**
 * A dragged row dropped before or after another. A child, or a top-level
 * row without children in a menu that has them (`nested`), takes the
 * other row's level; a row with children stays top-level, beside the
 * other's block. Null: nothing moves.
 */
export function drop(
  rows: readonly MenuRow[],
  fromKey: string,
  toKey: string,
  place: DropPlace,
  nested: boolean
): MenuRow[] | null {
  const from = rows.findIndex((row) => row.key === fromKey)
  const moving = rows[from]
  if (!moving || fromKey === toKey) {
    return null
  }
  const unit = rows.slice(from, blockEnd(rows, from))
  if (unit.some((row) => row.key === toKey)) {
    return null
  }
  const rest = [...rows.slice(0, from), ...rows.slice(from + unit.length)]
  const target = rest.findIndex((row) => row.key === toKey)
  if (target < 0) {
    return null
  }
  const asChild = nested && unit.length === 1 && rest[target]?.depth === 1
  const start = blockStart(rest, target)
  const at = asChild
    ? target + (place === "after" ? 1 : 0)
    : place === "before"
      ? start
      : blockEnd(rest, start)
  const [head, ...children] = unit
  if (!head) {
    return null
  }
  return checked([
    ...rest.slice(0, at),
    { ...head, depth: asChild ? 1 : 0 },
    ...children,
    ...rest.slice(at),
  ])
}

/** A row's own wording, refused as the server refuses it; an address must have one. */
export function labelProblem(row: MenuRow): "required" | "tooLong" | "textInvalid" | null {
  const label = row.label.trim()
  if (label === "") {
    return row.to.kind === "url" ? "required" : null
  }
  if (label.length > MENU_LIMITS.label) {
    return "tooLong"
  }
  return isCleanText(label) ? null : "textInvalid"
}

/** The menu's title, as the server takes it. */
export function titleProblem(title: string): "required" | "tooLong" | "textInvalid" | null {
  const text = title.trim()
  if (text === "") {
    return "required"
  }
  if (text.length > MENU_LIMITS.title) {
    return "tooLong"
  }
  return isCleanText(text) ? null : "textInvalid"
}
