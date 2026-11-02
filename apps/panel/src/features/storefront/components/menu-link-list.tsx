import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MENU_LIMITS } from "@/features/storefront/api/menus"
import {
  drop,
  indent,
  labelProblem,
  moveDown,
  moveUp,
  outdent,
  parentsOf,
  removeRow,
} from "@/features/storefront/menu-rows"
import type { DropPlace, MenuRow } from "@/features/storefront/menu-rows"
import { shownName } from "@/features/storefront/shown-name"
import { MenuLinkRow } from "./menu-link-row"
import type { RowDrag } from "./menu-link-row"

interface MenuLinkListProps {
  rows: readonly MenuRow[]
  /** The header's menu: rows may sit under another. */
  nested: boolean
  /** A save was tried: the rows' mistakes show. */
  tried: boolean
  onRows: (rows: MenuRow[]) => void
  onChangeTarget: (row: MenuRow) => void
}

// A longer menu opens with its panels folded, so it reads as its top level first
const FOLD_FROM = 12

/** A menu's links in order, each movable by dragging or by its buttons. */
export function MenuLinkList({ rows, nested, tried, onRows, onChangeTarget }: MenuLinkListProps) {
  const { t } = useTranslation()
  const [dragged, setDragged] = useState<string | null>(null)
  const [over, setOver] = useState<{ key: string; place: DropPlace } | null>(null)
  const [folded, setFolded] = useState<ReadonlySet<string>>(
    () => new Set(rows.length > FOLD_FROM ? parentsOf(rows).values() : [])
  )
  const parents = parentsOf(rows)
  const childCount = new Map<string, number>()
  for (const parent of parents.values()) {
    childCount.set(parent, (childCount.get(parent) ?? 0) + 1)
  }
  // A failed save opens the panels whose links it marked
  const marked = new Set(
    tried ? rows.flatMap((row) => (labelProblem(row) ? [parents.get(row.key) ?? row.key] : [])) : []
  )
  const isOpen = (key: string) => !folded.has(key) || marked.has(key)
  const unfold = (key: string) => {
    setFolded((was) => new Set([...was].filter((each) => each !== key)))
  }
  const toggle = (key: string) => {
    if (folded.has(key)) {
      unfold(key)
    } else {
      setFolded((was) => new Set([...was, key]))
    }
  }
  // A row moved under a folded one opens it, so the row stays in sight
  const apply = (next: MenuRow[], key: string) => {
    const parent = parentsOf(next).get(key)
    if (parent) {
      unfold(parent)
    }
    onRows(next)
  }
  const stop = () => {
    setDragged(null)
    setOver(null)
  }
  const dragOf = (row: MenuRow): RowDrag => ({
    active: dragged !== null,
    dragging: dragged === row.key,
    over: over?.key === row.key ? over.place : null,
    onStart: () => {
      setDragged(row.key)
    },
    onEnd: stop,
    onOver: (place) => {
      // Marked only where a drop would land
      const lands = dragged !== null && drop(rows, dragged, row.key, place, nested) !== null
      if (!lands) {
        setOver(null)
      } else if (over?.key !== row.key || over.place !== place) {
        setOver({ key: row.key, place })
      }
    },
    onDrop: (place) => {
      const next = dragged ? drop(rows, dragged, row.key, place, nested) : null
      if (next && dragged) {
        apply(next, dragged)
      }
      stop()
    },
  })
  return (
    <div className="@container">
      <ol className="flex flex-col divide-y rounded-md border">
        {rows.map((row, index) => {
          const parent = parents.get(row.key)
          if (parent && !isOpen(parent)) {
            return null
          }
          const placeholder = shownName(t, row)
          const own = row.label.trim()
          const name = own !== "" ? own : row.to.kind === "url" ? row.to.url : placeholder
          const problem = tried ? labelProblem(row) : null
          const children = childCount.get(row.key) ?? 0
          return (
            <MenuLinkRow
              key={row.key}
              row={row}
              placeholder={placeholder}
              name={name}
              error={
                problem
                  ? t(`storefront.menus.errors.${problem}`, { max: MENU_LIMITS.label })
                  : undefined
              }
              nested={nested}
              childCount={children}
              open={children > 0 ? isOpen(row.key) : null}
              onToggle={() => {
                toggle(row.key)
              }}
              moves={{
                up: moveUp(rows, index),
                down: moveDown(rows, index),
                indent: nested ? indent(rows, index) : null,
                outdent: nested ? outdent(rows, index) : null,
              }}
              drag={dragOf(row)}
              onRows={(next) => {
                apply(next, row.key)
              }}
              onLabel={(label) => {
                onRows(rows.map((each) => (each.key === row.key ? { ...each, label } : each)))
              }}
              onChangeTarget={() => {
                onChangeTarget(row)
              }}
              onRemove={() => {
                onRows(removeRow(rows, index))
              }}
            />
          )
        })}
      </ol>
    </div>
  )
}
