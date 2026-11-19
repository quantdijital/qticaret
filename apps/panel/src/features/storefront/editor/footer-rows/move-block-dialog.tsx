import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FOOTER_ROWS_LIMITS as L } from "@qticaret/types"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import type { FooterRow } from "@/features/storefront/api/layout"
import { FR } from "./footer-rows-fields"
import { findBlock } from "./footer-rows-ops"
import type { BlockTarget } from "./footer-rows-ops"

/**
 * "Taşı…" (adr/0070 §7, WCAG 2.5.7): the block's way to another row and
 * column without dragging. Every column is a choice, named by its row and
 * place; a full one is closed; the block lands at the end of the one
 * picked.
 */
export function MoveBlockDialog({
  rows,
  block,
  name,
  onMove,
  onClose,
}: {
  rows: readonly FooterRow[]
  /** The block's id; null: the dialog is closed. */
  block: string | null
  name: string
  onMove: (target: BlockTarget) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const found = block ? findBlock(rows, block) : null
  const here = found ? `${String(found.row)}:${String(found.column)}` : ""
  const [picked, setPicked] = useState<string | null>(null)
  const value = picked ?? here
  const close = () => {
    setPicked(null)
    onClose()
  }
  return (
    <Dialog
      open={found !== null}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t(`${FR}.move.title`, { name })}</DialogTitle>
          <DialogDescription>{t(`${FR}.move.description`)}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label={t(`${FR}.move.target`)}
          value={value}
          onValueChange={setPicked}
          className="max-h-80 gap-1 overflow-y-auto px-1"
        >
          {rows.map((row, r) =>
            row.columns.map((column, c) => {
              const key = `${String(r)}:${String(c)}`
              const full = key !== here && column.blocks.length >= L.perColumn
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm has-[:disabled]:text-muted-foreground"
                >
                  <RadioGroupItem value={key} disabled={full} />
                  {t(`${FR}.move.place`, { row: r + 1, column: c + 1 })}
                  {full ? (
                    <span className="text-xs">
                      {t(`${FR}.add.columnFull`, { max: L.perColumn })}
                    </span>
                  ) : null}
                </label>
              )
            })
          )}
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={value === here}
            onClick={() => {
              const [r, c] = value.split(":").map(Number)
              const row = rows[r ?? -1]
              const column = row?.columns[c ?? -1]
              if (row && column && c !== undefined) {
                onMove({ row: row.id, column: c, index: column.blocks.length })
              }
              close()
            }}
          >
            {t(`${FR}.move.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
