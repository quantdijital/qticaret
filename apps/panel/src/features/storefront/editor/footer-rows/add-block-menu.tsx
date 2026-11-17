import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FOOTER_BLOCK_MAX, FOOTER_BLOCK_TYPES, FOOTER_ROWS_LIMITS as L } from "@qticaret/types"
import type { FooterBlockType } from "@qticaret/types"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import type { FooterRow } from "@/features/storefront/api/layout"
import { FR } from "./footer-rows-fields"
import { BLOCK_ICONS } from "./footer-rows-names"
import { blockRoom } from "./footer-rows-ops"

/**
 * "Blok ekle" at a column's end (adr/0070 §7): every block type with its
 * small drawing and a line on what it shows; a type the footer holds as
 * many of as it may, a full column or a full footer, stays listed but
 * closed, the reason written under its name.
 */
export function AddBlockMenu({
  rows,
  row,
  column,
  label,
  onPick,
}: {
  rows: readonly FooterRow[]
  row: number
  column: number
  /** The button's name for a screen reader: which column it adds to. */
  label: string
  onPick: (type: FooterBlockType) => void
}) {
  const { t } = useTranslation()
  const why = (type: FooterBlockType) => {
    const room = blockRoom(rows, type, { row, column })
    return room === null
      ? null
      : room === "type"
        ? t(`${FR}.add.typeFull`, { count: FOOTER_BLOCK_MAX[type] })
        : room === "column"
          ? t(`${FR}.add.columnFull`, { max: L.perColumn })
          : t(`${FR}.add.footerFull`, { max: L.blocks })
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={label}
          className="h-7 w-full justify-start px-2 text-xs text-primary-text"
        >
          <Plus />
          {t(`${FR}.add.block`)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t(`${FR}.add.title`)}</DropdownMenuLabel>
        {FOOTER_BLOCK_TYPES.map((type) => {
          const Icon = BLOCK_ICONS[type]
          const reason = why(type)
          return (
            <DropdownMenuItem
              key={type}
              disabled={reason !== null}
              className="items-start gap-2.5 py-2"
              onSelect={() => {
                onPick(type)
              }}
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded border bg-muted/40"
              >
                <Icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm">{t(`${FR}.types.${type}.name`)}</span>
                <span className="text-xs text-muted-foreground">
                  {reason ?? t(`${FR}.types.${type}.description`)}
                </span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
