import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import type { FieldError, UseFormRegisterReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STOREFRONT_LIMITS, errorLine } from "@/features/settings/storefront"
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

// Name, address, actions side by side once the card is wide enough; on a
// narrow one the name shares its line with the actions and the address
// takes the next
const LINK_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 @lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]"

type LinkErrors = { label?: FieldError | undefined; href?: FieldError | undefined } | undefined

interface LinkRowsProps {
  rows: readonly { id: string }[]
  /** Ids and names start with it: one card may hold several lists. */
  idPrefix: string
  register: (index: number, key: "label" | "href") => UseFormRegisterReturn
  errors: (index: number) => LinkErrors
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
  /** The fewest links the list keeps (a footer column: one). */
  minimum?: number
  /** The list's owner in each field's name ("2. sütun"), when a card holds several. */
  within?: string
}

/** Links as rows of a name and an address, each movable and removable. */
export function LinkRows({
  rows,
  idPrefix,
  register,
  errors,
  onMove,
  onRemove,
  minimum = 0,
  within,
}: LinkRowsProps) {
  const { t } = useTranslation()
  const named = (name: string) => (within ? t(`${S}.links.within`, { within, name }) : name)
  if (rows.length === 0) {
    return null
  }
  return (
    <div className="@container flex flex-col gap-2">
      {/* Column names over the rows; each field also carries its own */}
      <div
        aria-hidden
        className={cn(LINK_GRID, "hidden text-xs font-medium text-muted-foreground @lg:grid")}
      >
        <span>{t(`${S}.links.label`)}</span>
        <span>{t(`${S}.links.href`)}</span>
        <span className="w-29" />
      </div>
      <ol className="flex flex-col gap-3 @lg:gap-2">
        {rows.map((row, index) => {
          const error = errors(index)
          const number = index + 1
          const labelError = errorLine(t, error?.label, STOREFRONT_LIMITS.linkLabelLength)
          const hrefError = errorLine(t, error?.href)
          const id = `${idPrefix}-${index}`
          return (
            <li key={row.id} className={LINK_GRID}>
              <RowCell error={labelError} errorId={`${id}-label-error`} className="col-start-1">
                <Input
                  aria-label={named(t(`${S}.links.labelOf`, { number }))}
                  aria-invalid={Boolean(labelError)}
                  aria-describedby={labelError ? `${id}-label-error` : undefined}
                  placeholder={t(`${S}.links.labelPlaceholder`)}
                  {...register(index, "label")}
                />
              </RowCell>
              <RowCell
                error={hrefError}
                errorId={`${id}-href-error`}
                className="col-span-2 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1"
              >
                <Input
                  aria-label={named(t(`${S}.links.hrefOf`, { number }))}
                  aria-invalid={Boolean(hrefError)}
                  aria-describedby={hrefError ? `${id}-href-error` : undefined}
                  placeholder={t(`${S}.links.hrefPlaceholder`)}
                  autoComplete="off"
                  spellCheck={false}
                  {...register(index, "href")}
                />
              </RowCell>
              <RowActions
                index={index}
                count={rows.length}
                item={named(t(`${S}.links.item`, { number }))}
                removable={rows.length > minimum}
                className="col-start-2 row-start-1 @lg:col-start-3"
                onMove={(to) => {
                  onMove(index, to)
                }}
                onRemove={() => {
                  onRemove(index)
                }}
              />
            </li>
          )
        })}
      </ol>
    </div>
  )
}
