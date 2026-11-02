import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const S = "settings.storefront"

interface RowActionsProps {
  index: number
  count: number
  /** What the row is, for the buttons' names ("2. bağlantı"). */
  item: string
  onMove: (to: number) => void
  onRemove: () => void
  /** A footer column keeps its last link: the column is removed instead. */
  removable?: boolean
  className?: string
}

/** Move a row up or down, or remove it; each button as tall as the row's fields. */
export function RowActions({
  index,
  count,
  item,
  onMove,
  onRemove,
  removable = true,
  className,
}: RowActionsProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("flex shrink-0 gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === 0}
        aria-label={t(`${S}.moveUp`, { item })}
        onClick={() => {
          onMove(index - 1)
        }}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={index === count - 1}
        aria-label={t(`${S}.moveDown`, { item })}
        onClick={() => {
          onMove(index + 1)
        }}
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive-text"
        disabled={!removable}
        aria-label={t(`${S}.remove`, { item })}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

/** A field in a row with its error under it; the row's fields stay aligned at the top. */
export function RowCell({
  error,
  errorId,
  className,
  children,
}: {
  error: string | undefined
  errorId: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Under a list: the add button, and how many the list may hold. */
export function ListFooter({
  label,
  hint,
  full,
  onAdd,
}: {
  label: string
  hint: string
  full: boolean
  onAdd: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button type="button" size="sm" variant="outline" disabled={full} onClick={onAdd}>
        <Plus />
        {label}
      </Button>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}

/** A list with nothing in it yet: what the storefront shows instead. */
export function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
      {text}
    </p>
  )
}
