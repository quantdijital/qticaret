import { Columns3, Copy, MoveRight, Settings2, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { FooterBlock } from "@/features/storefront/api/layout"
import { partHasProblem } from "@/features/storefront/layout/footer-rows-problems"
import type { SectionProblems } from "@/features/storefront/layout/problems"
import { AddBlockMenu } from "./add-block-menu"
import type { FooterDrag } from "./footer-drag"
import { FR } from "./footer-rows-fields"
import type { FooterPart } from "./footer-rows-fields"
import { BLOCK_ICONS, blockName, columnName } from "./footer-rows-names"
import {
  addBlock,
  blockRoom,
  duplicateBlock,
  removeBlock,
  stepTarget,
  updateBlock,
} from "./footer-rows-ops"
import type { BlockTarget, Rows } from "./footer-rows-ops"
import { newBlock } from "./footer-rows-seed"
import { PartRow } from "./part-row"

interface FooterColumnNodeProps {
  rows: Rows
  row: number
  column: number
  menus: readonly string[] | null
  problems: SectionProblems
  openedPart: string | null
  drag: FooterDrag
  newId: () => string
  /** The footer's rows changed; true when something did. */
  onChange: (rows: Rows) => boolean
  onStep: (id: string, target: BlockTarget) => void
  onOpenPart: (part: FooterPart) => void
  onMoveDialog: (id: string) => void
}

/**
 * A column in the footer tree: its name, its blocks in order and "Blok
 * ekle" at its end. The column itself takes a dragged block (at its end),
 * so an empty one is a target too.
 */
export function FooterColumnNode({
  rows,
  row,
  column,
  menus,
  problems,
  openedPart,
  drag,
  newId,
  onChange,
  onStep,
  onOpenPart,
  onMoveDialog,
}: FooterColumnNodeProps) {
  const { t } = useTranslation()
  const line = rows[row]
  const blocks = line?.columns[column]?.blocks ?? []
  if (!line) {
    return null
  }
  const name = columnName(t, line, column)
  const target =
    drag.over?.kind === "column" && drag.over.row === line.id && drag.over.column === column
  const actions = (block: FooterBlock) => [
    {
      label: t(`${FR}.actions.open`),
      icon: Settings2,
      onSelect: () => {
        onOpenPart({ kind: "block", id: block.id })
      },
    },
    {
      label: t(`${FR}.actions.move`),
      icon: MoveRight,
      onSelect: () => {
        onMoveDialog(block.id)
      },
    },
    {
      label: t(`${FR}.actions.duplicate`),
      icon: Copy,
      disabled: blockRoom(rows, block.type, { row, column }) !== null,
      onSelect: () => {
        onChange(duplicateBlock(rows, block.id, newId))
      },
    },
    {
      label: t(`${FR}.actions.remove`),
      icon: Trash2,
      destructive: true,
      onSelect: () => {
        onChange(removeBlock(rows, block.id))
      },
    },
  ]
  return (
    <li className="flex flex-col">
      <div
        className={cn(
          "flex h-7 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground",
          target && "bg-primary/10 ring-1 ring-primary/40"
        )}
        onDragOver={(event) => {
          if (drag.overColumn(line.id, column)) {
            event.preventDefault()
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          drag.dropColumn(line.id, column)
        }}
      >
        <Columns3 className="size-3.5 shrink-0" aria-hidden="true" />
        {name}
      </div>
      <ol aria-label={name} className="flex flex-col gap-0.5 pl-4">
        {blocks.map((block) => {
          const label = blockName(t, block, menus)
          const up = stepTarget(rows, block.id, -1)
          const down = stepTarget(rows, block.id, 1)
          return (
            <PartRow
              key={block.id}
              kind="block"
              id={block.id}
              icon={BLOCK_ICONS[block.type]}
              name={label.name}
              detail={label.detail}
              current={openedPart === block.id}
              problem={partHasProblem(problems, `blocks.${block.id}`)}
              visible={block.visible}
              onToggle={() => {
                onChange(updateBlock(rows, { ...block, visible: !block.visible }))
              }}
              onOpen={() => {
                onOpenPart({ kind: "block", id: block.id })
              }}
              moves={{
                up: up
                  ? () => {
                      onStep(block.id, up)
                    }
                  : null,
                down: down
                  ? () => {
                      onStep(block.id, down)
                    }
                  : null,
              }}
              actions={actions(block)}
              drag={drag}
            />
          )
        })}
        {blocks.length === 0 ? (
          <li
            className={cn(
              "rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground",
              target && "border-primary"
            )}
            onDragOver={(event) => {
              if (drag.overColumn(line.id, column)) {
                event.preventDefault()
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              drag.dropColumn(line.id, column)
            }}
          >
            {t(`${FR}.tree.empty`)}
          </li>
        ) : null}
        <li>
          <AddBlockMenu
            rows={rows}
            row={row}
            column={column}
            label={t(`${FR}.add.blockTo`, { row: row + 1, column: name })}
            onPick={(type) => {
              const block = newBlock(type, newId())
              if (onChange(addBlock(rows, { row: line.id, column }, block))) {
                onOpenPart({ kind: "block", id: block.id })
              }
            }}
          />
        </li>
      </ol>
    </li>
  )
}
