import { useTranslation } from "react-i18next"
import { HiddenHint } from "@qticaret/admin-ui/patterns/info-tip"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import type { ShelfColumns } from "@/features/storefront/api/layout"
import { SHELF_COLUMNS } from "@/features/storefront/api/layout"
import { HintedName } from "./field-hint"
import { F } from "./fields"

/** The rows a wide screen shows of a rail: two. */
const ROWS = 2

/**
 * A product rail's cards in a row on a wide screen (adr/0049 Ek
 * 2026-11-05): 3, 4 or 5 side by side as one segmented control, each
 * option drawing its row in small. Under it what the storefront does on
 * narrower screens, and, when the rail's count does not fill two rows,
 * the count that would (the storefront shows whole rows only).
 */
export function ColumnsField({
  id,
  value,
  limit,
  onChange,
}: {
  id: string
  value: ShelfColumns
  /** How many products the rail is given. */
  limit: number
  onChange: (value: ShelfColumns) => void
}) {
  const { t } = useTranslation()
  const full = value * ROWS
  const hint = t(`${F}.columnsHint.${String(value)}`, { total: full })
  const short = limit < full
  return (
    <div className="flex flex-col gap-2">
      <HintedName name={t(`${F}.columns`)} hint={hint} hintId={`${id}-hint`}>
        <span id={`${id}-label`} className="text-sm font-medium">
          {t(`${F}.columns`)}{" "}
          <small className="text-[11px] font-normal text-muted-foreground">
            {t(`${F}.columnsTerm`)}
          </small>
        </span>
      </HintedName>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-labelledby={`${id}-label`}
        aria-describedby={short ? `${id}-hint ${id}-short` : `${id}-hint`}
        value={String(value)}
        onValueChange={(next) => {
          if (next) {
            onChange(Number(next) as ShelfColumns)
          }
        }}
        className="w-full"
      >
        {SHELF_COLUMNS.map((count) => (
          <ToggleGroupItem
            key={count}
            value={String(count)}
            aria-label={t(`${F}.columnsOption`, { n: count })}
            className="h-auto flex-1 flex-col gap-1.5 px-3 py-2 text-[13px] data-[state=on]:bg-accent data-[state=on]:font-medium data-[state=on]:text-accent-foreground"
          >
            <span aria-hidden="true" className="flex w-full max-w-16 gap-0.5">
              {Array.from({ length: count }, (_, index) => (
                <span key={index} className="h-3 flex-1 rounded-sm bg-current opacity-40" />
              ))}
            </span>
            <span className="tabular-nums">{count}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <HiddenHint id={`${id}-hint`}>{hint}</HiddenHint>
      {/* What the shop has to change stays in sight */}
      {short ? (
        <p id={`${id}-short`} className="text-xs text-muted-foreground">
          {t(`${F}.columnsShort`, { total: full })}
        </p>
      ) : null}
    </div>
  )
}
