import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ListIndentDecrease,
  ListIndentIncrease,
  Pencil,
  Trash2,
} from "lucide-react"
import type { DragEvent, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { DropPlace, MenuRow } from "@/features/storefront/menu-rows"
import { cn } from "@/lib/utils"

const R = "storefront.menus.row"

/** What a row may do now: each the rows after it, or null when it cannot. */
export interface RowMoves {
  up: MenuRow[] | null
  down: MenuRow[] | null
  /** Only the header's menu has children. */
  indent: MenuRow[] | null
  outdent: MenuRow[] | null
}

/** The editor's drag state as one row sees it. */
export interface RowDrag {
  /** A row of this menu is being dragged: text dragged in from elsewhere is left to the field. */
  active: boolean
  /** This row is the one being dragged. */
  dragging: boolean
  /** A drop here lands before or after this row. */
  over: DropPlace | null
  onStart: () => void
  onEnd: () => void
  onOver: (place: DropPlace) => void
  onDrop: (place: DropPlace) => void
}

interface MenuLinkRowProps {
  row: MenuRow
  /** The name the storefront shows when no own wording is given. */
  placeholder: string
  /** The row's name in its buttons' names. */
  name: string
  error: string | undefined
  nested: boolean
  /** How many links sit under it (a top-level row of the header's menu). */
  childCount: number
  /** Its children shown (true) or folded away (false); null: it has none to fold. */
  open: boolean | null
  onToggle: () => void
  moves: RowMoves
  drag: RowDrag
  onRows: (rows: MenuRow[]) => void
  onLabel: (label: string) => void
  onChangeTarget: () => void
  onRemove: () => void
}

// The upper half of a row drops before it, the lower half after
const placeOf = (event: DragEvent<HTMLElement>): DropPlace => {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "before" : "after"
}

/**
 * One link of a menu: a handle to drag it by, its name (the shop's own
 * wording over the record's), what it points at, a warning when the
 * storefront hides it, and buttons that do what dragging does (WCAG 2.5.7).
 */
export function MenuLinkRow({
  row,
  placeholder,
  name,
  error,
  nested,
  childCount,
  open,
  onToggle,
  moves,
  drag,
  onRows,
  onLabel,
  onChangeTarget,
  onRemove,
}: MenuLinkRowProps) {
  const { t } = useTranslation()
  const id = `menu-link-${row.key}`
  const action = (label: string, icon: ReactNode, next: MenuRow[] | null) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={!next}
      aria-label={t(label, { name })}
      onClick={() => {
        if (next) {
          onRows(next)
        }
      }}
    >
      {icon}
    </Button>
  )
  return (
    <li
      data-depth={row.depth}
      className={cn(
        "relative flex flex-wrap items-start gap-x-1.5 gap-y-1 px-2 py-1.5",
        row.depth === 1 && "pl-8 sm:pl-14",
        drag.dragging && "opacity-50"
      )}
      onDragOver={(event) => {
        if (drag.active) {
          event.preventDefault()
          drag.onOver(placeOf(event))
        }
      }}
      onDrop={(event) => {
        if (drag.active) {
          event.preventDefault()
          drag.onDrop(placeOf(event))
        }
      }}
    >
      {drag.over ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 z-10 h-0.5 bg-primary",
            drag.over === "before" ? "-top-px" : "-bottom-px"
          )}
        />
      ) : null}
      {/* A pointer's way to move it; the buttons are the keyboard's */}
      <span
        draggable
        aria-hidden="true"
        title={t(`${R}.drag`)}
        className="flex h-9 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move"
          // Firefox starts a drag only with data; the row itself is what follows the pointer
          event.dataTransfer.setData("text/plain", row.key)
          const item = event.currentTarget.closest("li")
          if (item) {
            event.dataTransfer.setDragImage(item, 16, 16)
          }
          drag.onStart()
        }}
        onDragEnd={drag.onEnd}
      >
        <GripVertical className="size-4" />
      </span>
      {nested && row.depth === 0 ? (
        open === null ? (
          // Where the fold button sits on a row with children: the names stay in one column
          <span aria-hidden="true" className="size-9 shrink-0" />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-label={t(open ? `${R}.fold` : `${R}.unfold`, { name })}
            onClick={onToggle}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </Button>
        )
      ) : null}
      {/* Name, then what it points at: one line on a wide card, two on a narrow one */}
      <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-1 @2xl:flex-row @2xl:items-center @2xl:gap-3">
        <div className="flex flex-col gap-1 @2xl:w-64 @2xl:shrink-0">
          <Input
            id={id}
            value={row.label}
            placeholder={placeholder}
            aria-label={t(`${R}.label`, { name })}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            maxLength={200}
            onChange={(event) => {
              onLabel(event.target.value)
            }}
          />
          {error ? (
            <p id={`${id}-error`} role="alert" className="text-xs text-destructive-text">
              {error}
            </p>
          ) : null}
        </div>
        <LinkFacts row={row} childCount={childCount} />
      </div>
      <div className="ml-auto flex shrink-0 gap-0.5">
        {action(`${R}.moveUp`, <ArrowUp />, moves.up)}
        {action(`${R}.moveDown`, <ArrowDown />, moves.down)}
        {nested
          ? row.depth === 0
            ? action(`${R}.indent`, <ListIndentIncrease />, moves.indent)
            : action(`${R}.outdent`, <ListIndentDecrease />, moves.outdent)
          : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t(`${R}.change`, { name })}
          onClick={onChangeTarget}
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive-text"
          aria-label={t(`${R}.remove`, { name })}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}

/** What a link points at, how many sit under it, and why the storefront hides it. */
function LinkFacts({ row, childCount }: { row: MenuRow; childCount: number }) {
  const { t } = useTranslation()
  const missing = row.broken && row.name === null && row.to.kind !== "legal"
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <Badge variant="outline" className="font-normal">
        {t(`storefront.menus.kinds.${row.to.kind}`)}
      </Badge>
      {row.path ? <span className="min-w-0 truncate">{row.path}</span> : null}
      {childCount > 0 ? <span>{t(`${R}.children`, { count: childCount })}</span> : null}
      {row.broken ? (
        <>
          <StatusBadge tone={missing ? "danger" : "warning"}>
            {t(missing ? `${R}.notFound` : `${R}.notLive`)}
          </StatusBadge>
          <span>{t(missing ? `${R}.notFoundHint` : `${R}.notLiveHint`)}</span>
        </>
      ) : null}
    </div>
  )
}
