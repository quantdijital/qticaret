import { useState } from "react"
import type { DragEvent } from "react"
import type { FooterRow } from "@/features/storefront/api/layout"
import type { DropPlace } from "../section-row"
import { findBlock } from "./footer-rows-ops"
import type { BlockTarget } from "./footer-rows-ops"

/**
 * The footer tree's drag and drop (adr/0070 §7), the page list's way
 * (`section-list.tsx`, native HTML5, by a handle): a row is dropped before
 * or after another row; a block before or after another block, in any
 * column of any row, or into a column (its end; an empty one has its own
 * target). What a drop does is the arrow buttons' and "Taşı…"'s too.
 */

type Dragged = { kind: "row" | "block"; id: string } | null

/** Where the pointer would drop: before or after a row or block, or into a column. */
export type DropOver =
  | { kind: "row" | "block"; id: string; place: DropPlace }
  | { kind: "column"; row: string; column: number }
  | null

/** The upper half of a line drops before it, the lower half after. */
export const placeOf = (event: DragEvent<HTMLElement>): DropPlace => {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "before" : "after"
}

/** Where a block dropped before or after `target` lands; null: it would not move. */
export function blockDrop(
  rows: readonly FooterRow[],
  dragged: string,
  target: string,
  place: DropPlace
): BlockTarget | null {
  const from = findBlock(rows, dragged)
  const at = findBlock(rows, target)
  const row = at ? rows[at.row] : undefined
  if (!from || !at || !row || dragged === target) {
    return null
  }
  const same = from.row === at.row && from.column === at.column
  // Its place once the dragged block has left its own
  const index =
    (place === "before" ? at.index : at.index + 1) - (same && from.index < at.index ? 1 : 0)
  return same && index === from.index ? null : { row: row.id, column: at.column, index }
}

/** Where a row dropped before or after `target` lands, as its new index; null: it would not move. */
export function rowDrop(
  rows: readonly FooterRow[],
  dragged: string,
  target: string,
  place: DropPlace
): number | null {
  const from = rows.findIndex((row) => row.id === dragged)
  const at = rows.findIndex((row) => row.id === target)
  if (from < 0 || at < 0 || dragged === target) {
    return null
  }
  const to = (place === "before" ? at : at + 1) - (from < at ? 1 : 0)
  return to === from ? null : to
}

export function useFooterDrag(
  rows: readonly FooterRow[],
  onMoveRow: (id: string, to: number) => void,
  onMoveBlock: (id: string, target: BlockTarget) => void
) {
  const [dragged, setDragged] = useState<Dragged>(null)
  const [over, setOver] = useState<DropOver>(null)
  const stop = () => {
    setDragged(null)
    setOver(null)
  }
  const mark = (next: DropOver) => {
    if (JSON.stringify(next) !== JSON.stringify(over)) {
      setOver(next)
    }
  }
  return {
    dragged,
    over,
    start: (kind: "row" | "block", id: string) => {
      setDragged({ kind, id })
    },
    stop,
    /** Over a row's or a block's line: marked only where a drop would move something. */
    overLine: (kind: "row" | "block", id: string, place: DropPlace) => {
      if (dragged?.kind !== kind) {
        return false
      }
      const lands =
        kind === "row"
          ? rowDrop(rows, dragged.id, id, place) !== null
          : blockDrop(rows, dragged.id, id, place) !== null
      mark(lands ? { kind, id, place } : null)
      return lands
    },
    /** Over a column's own target: a block lands at its end. */
    overColumn: (row: string, column: number) => {
      if (dragged?.kind !== "block") {
        return false
      }
      mark({ kind: "column", row, column })
      return true
    },
    dropLine: (kind: "row" | "block", id: string, place: DropPlace) => {
      if (dragged?.kind === "row" && kind === "row") {
        const to = rowDrop(rows, dragged.id, id, place)
        if (to !== null) {
          onMoveRow(dragged.id, to)
        }
      } else if (dragged?.kind === "block" && kind === "block") {
        const target = blockDrop(rows, dragged.id, id, place)
        if (target) {
          onMoveBlock(dragged.id, target)
        }
      }
      stop()
    },
    dropColumn: (row: string, column: number) => {
      if (dragged?.kind === "block") {
        const blocks = rows.find((each) => each.id === row)?.columns[column]?.blocks.length ?? 0
        onMoveBlock(dragged.id, { row, column, index: blocks })
      }
      stop()
    },
  }
}

export type FooterDrag = ReturnType<typeof useFooterDrag>
