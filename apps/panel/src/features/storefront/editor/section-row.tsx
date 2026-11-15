import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  CircleAlert,
  Clock,
  Copy,
  Ellipsis,
  Eye,
  EyeOff,
  GripVertical,
  Settings2,
  Trash2,
} from "lucide-react"
import { useContext } from "react"
import type { DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import type { LucideIcon } from "lucide-react"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { OpenedSectionContext, SectionHoverContext } from "./editor-layout"

const R = "storefront.editor.row"

export type DropPlace = "before" | "after"

/** The list's drag state as one row sees it (home sections only). */
export interface RowDrag {
  active: boolean
  dragging: boolean
  over: DropPlace | null
  onStart: () => void
  onEnd: () => void
  onOver: (place: DropPlace) => void
  onDrop: (place: DropPlace) => void
}

interface SectionRowProps {
  id: string
  icon: LucideIcon
  name: string
  /** The type, when the name is the shop's own title. */
  detail: string | null
  visible: boolean
  scheduled: boolean
  problem: boolean
  onOpen: () => void
  onToggle: () => void
  onRemove: () => void
  /** Home sections move and copy; the header's and footer's stay put. */
  moves?: { up: (() => void) | null; down: (() => void) | null }
  onDuplicate?: (() => void) | null
  drag?: RowDrag
  /** A category page's section: to the other side of the products. */
  onPlace?: { to: "top" | "bottom"; run: () => void } | undefined
}

// The upper half of a row drops before it, the lower half after
const placeOf = (event: DragEvent<HTMLElement>): DropPlace => {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "before" : "after"
}

/**
 * A section in the tree: dragged by its handle, opened by its name, shown
 * or hidden by its eye, and moved, copied or removed from its menu. The
 * arrow buttons are the keyboard's and a single pointer's way to move it
 * (WCAG 2.5.7); they show while the row is pointed at or holds the focus.
 */
export function SectionRow({
  id,
  icon: Icon,
  name,
  detail,
  visible,
  scheduled,
  problem,
  onOpen,
  onToggle,
  onRemove,
  moves,
  onDuplicate,
  drag,
  onPlace,
}: SectionRowProps) {
  const { t } = useTranslation()
  // Its settings open beside the list: the row stays marked
  const current = useContext(OpenedSectionContext) === id
  // Pointed at in the preview: the row lights up; pointed at here, the preview frames it
  const { hovered, hover } = useContext(SectionHoverContext)
  return (
    <li
      data-section={id}
      data-hovered={hovered === id ? "" : undefined}
      className={cn(
        "group/row relative flex items-center gap-0.5 rounded-md py-0.5 pr-1 hover:bg-muted/60 focus-within:bg-muted/60",
        hovered === id && "bg-muted/60 ring-1 ring-primary/40",
        current && "bg-muted",
        drag?.dragging && "opacity-50"
      )}
      onPointerEnter={() => {
        hover(id)
      }}
      onPointerLeave={() => {
        hover(null)
      }}
      onDragOver={(event) => {
        if (drag?.active) {
          event.preventDefault()
          drag.onOver(placeOf(event))
        }
      }}
      onDrop={(event) => {
        if (drag?.active) {
          event.preventDefault()
          drag.onDrop(placeOf(event))
        }
      }}
    >
      {drag?.over ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-1 z-10 h-0.5 bg-primary",
            drag.over === "before" ? "-top-px" : "-bottom-px"
          )}
        />
      ) : null}
      {drag ? (
        <span
          draggable
          aria-hidden="true"
          title={t(`${R}.drag`)}
          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move"
            // Firefox starts a drag only with data; the row is what follows the pointer
            event.dataTransfer.setData("text/plain", id)
            const row = event.currentTarget.closest("li")
            if (row) {
              event.dataTransfer.setDragImage(row, 16, 16)
            }
            drag.onStart()
          }}
          onDragEnd={drag.onEnd}
        >
          <GripVertical className="size-3.5" />
        </span>
      ) : (
        <span aria-hidden="true" className="w-5 shrink-0" />
      )}
      <button
        type="button"
        title={detail ?? undefined}
        aria-current={current ? "true" : undefined}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-sm",
          current && "font-medium",
          !visible && "text-muted-foreground"
        )}
        onClick={onOpen}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{name}</span>
        {problem ? (
          <CircleAlert
            role="img"
            aria-label={t(`${R}.problem`)}
            className="size-3.5 shrink-0 text-destructive-text"
          />
        ) : null}
        {scheduled ? (
          <Clock
            role="img"
            aria-label={t(`${R}.scheduled`)}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        ) : null}
      </button>
      {moves ? (
        <div className="hidden shrink-0 group-focus-within/row:flex group-hover/row:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!moves.up}
            aria-label={t(`${R}.moveUpOf`, { name })}
            onClick={() => moves.up?.()}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!moves.down}
            aria-label={t(`${R}.moveDownOf`, { name })}
            onClick={() => moves.down?.()}
          >
            <ArrowDown />
          </Button>
        </div>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-pressed={!visible}
        aria-label={t(visible ? `${R}.hide` : `${R}.show`, { name })}
        className={cn(!visible && "text-muted-foreground")}
        onClick={onToggle}
      >
        {visible ? <Eye /> : <EyeOff />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t(`${R}.actions`, { name })}
          >
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}>
            <Settings2 />
            {t(`${R}.open`)}
          </DropdownMenuItem>
          {moves ? (
            <>
              <DropdownMenuItem disabled={!moves.up} onSelect={() => moves.up?.()}>
                <ArrowUp />
                {t(`${R}.moveUp`)}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!moves.down} onSelect={() => moves.down?.()}>
                <ArrowDown />
                {t(`${R}.moveDown`)}
              </DropdownMenuItem>
            </>
          ) : null}
          {onPlace ? (
            <DropdownMenuItem onSelect={onPlace.run}>
              {onPlace.to === "bottom" ? <ArrowDownToLine /> : <ArrowUpToLine />}
              {t(`${R}.place.${onPlace.to}`)}
            </DropdownMenuItem>
          ) : null}
          {onDuplicate !== undefined ? (
            <DropdownMenuItem disabled={!onDuplicate} onSelect={() => onDuplicate?.()}>
              <Copy />
              {t(`${R}.duplicate`)}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            <Trash2 />
            {t(`${R}.remove`)}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
