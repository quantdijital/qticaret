import { Copy, Lock, Plus, Rows3, Settings2, Trash2 } from "lucide-react"
import { useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { FooterRow, FooterRowsSection, LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { partHasProblem } from "@/features/storefront/layout/footer-rows-problems"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { idsOf, newSectionId } from "@/features/storefront/layout/sections"
import { FooterColumnNode } from "./footer-column-node"
import { useFooterDrag } from "./footer-drag"
import { FR } from "./footer-rows-fields"
import type { FooterPart } from "./footer-rows-fields"
import { blockName, rowName, useFooterMenus } from "./footer-rows-names"
import {
  addRow,
  duplicateRow,
  findBlock,
  moveBlock,
  moveRow,
  newRow,
  removeRow,
  rowRoom,
} from "./footer-rows-ops"
import type { BlockTarget, Rows } from "./footer-rows-ops"
import { MoveBlockDialog } from "./move-block-dialog"
import { PartRow } from "./part-row"

interface FooterRowsTreeProps {
  section: FooterRowsSection
  doc: LayoutDocument
  problems: SectionProblems
  dispatch: Dispatch<EditorAction>
  /** The row or block whose panel is open: its line stays marked. */
  openedPart: string | null
  onOpenPart: (part: FooterPart) => void
}

/**
 * The free rows footer in the page tree (adr/0070 §7): Row › Column ›
 * Block, nested lists as the page's groups are, each level indented.
 * Rows and blocks are dragged by their handles (blocks between columns
 * and rows too), moved by their arrows or "Taşı…", each change one step
 * of the editor's history; every move is said in a polite live region.
 * "Satır ekle" after the rows, "Blok ekle" at each column's end, and the
 * fixed legal strip and bottom line under all, not editable here.
 */
export function FooterRowsTree({
  section,
  doc,
  problems,
  dispatch,
  openedPart,
  onOpenPart,
}: FooterRowsTreeProps) {
  const { t } = useTranslation()
  const menus = useFooterMenus(doc)
  const [said, setSaid] = useState("")
  const [moving, setMoving] = useState<string | null>(null)
  const { rows } = section
  const newId = (() => {
    const taken = idsOf(doc)
    return () => {
      const id = newSectionId(taken)
      taken.add(id)
      return id
    }
  })()
  const change = (next: Rows) => {
    if (next !== rows) {
      dispatch({ type: "update", section: { ...section, rows: [...next] } })
    }
    return next !== rows
  }
  const placeName = (next: Rows, id: string) => {
    const at = findBlock(next, id)
    return at ? t(`${FR}.move.place`, { row: at.row + 1, column: at.column + 1 }) : ""
  }
  const moveTo = (id: string, target: BlockTarget) => {
    const found = findBlock(rows, id)
    const next = moveBlock(rows, id, target)
    if (found && change(next)) {
      const { name } = blockName(t, found.block, menus)
      setSaid(t(`${FR}.moved`, { name, place: placeName(next, id) }))
    }
  }
  const rowTo = (id: string, to: number) => {
    const next = moveRow(rows, id, to)
    if (change(next)) {
      setSaid(t(`${FR}.rowMoved`, { place: next.findIndex((row) => row.id === id) + 1 }))
    }
  }
  const drag = useFooterDrag(rows, rowTo, moveTo)
  const movingBlock = moving ? findBlock(rows, moving) : null

  const rowActions = (row: FooterRow, index: number) => [
    {
      label: t(`${FR}.actions.open`),
      icon: Settings2,
      onSelect: () => {
        onOpenPart({ kind: "row", id: row.id })
      },
    },
    {
      label: t(`${FR}.actions.duplicate`),
      icon: Copy,
      disabled: !rowRoom(rows, row),
      onSelect: () => {
        change(duplicateRow(rows, row.id, newId))
      },
    },
    {
      label: t(`${FR}.actions.removeRow`),
      icon: Trash2,
      destructive: true,
      disabled: rows.length <= 1,
      onSelect: () => {
        if (change(removeRow(rows, row.id))) {
          setSaid(t(`${FR}.rowRemoved`, { place: index + 1 }))
        }
      },
    },
  ]

  return (
    <div className="flex flex-col gap-1 pl-4">
      <ol aria-label={t(`${FR}.tree.rows`)} className="flex flex-col gap-0.5">
        {rows.map((row, index) => (
          <PartRow
            key={row.id}
            kind="row"
            id={row.id}
            icon={Rows3}
            name={rowName(t, row, index)}
            detail={null}
            current={openedPart === row.id}
            problem={partHasProblem(problems, `rows.${row.id}`)}
            onOpen={() => {
              onOpenPart({ kind: "row", id: row.id })
            }}
            moves={{
              up:
                index > 0
                  ? () => {
                      rowTo(row.id, index - 1)
                    }
                  : null,
              down:
                index < rows.length - 1
                  ? () => {
                      rowTo(row.id, index + 1)
                    }
                  : null,
            }}
            actions={rowActions(row, index)}
            drag={drag}
          >
            <ul aria-label={rowName(t, row, index)} className="flex flex-col gap-0.5 pl-5">
              {row.columns.map((_, column) => (
                <FooterColumnNode
                  key={column}
                  rows={rows}
                  row={index}
                  column={column}
                  menus={menus}
                  problems={problems}
                  openedPart={openedPart}
                  drag={drag}
                  newId={newId}
                  onChange={change}
                  onStep={moveTo}
                  onOpenPart={onOpenPart}
                  onMoveDialog={setMoving}
                />
              ))}
            </ul>
          </PartRow>
        ))}
      </ol>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start text-primary-text"
        disabled={!rowRoom(rows)}
        onClick={() => {
          const row = newRow(newId())
          if (change(addRow(rows, row))) {
            onOpenPart({ kind: "row", id: row.id })
          }
        }}
      >
        <Plus />
        {t(`${FR}.add.row`)}
      </Button>
      <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" />
        {t(`${FR}.tree.fixed`)}
      </p>
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
      <MoveBlockDialog
        rows={rows}
        block={moving}
        name={movingBlock ? blockName(t, movingBlock.block, menus).name : ""}
        onMove={(target) => {
          if (moving) moveTo(moving, target)
        }}
        onClose={() => {
          setMoving(null)
        }}
      />
    </div>
  )
}
