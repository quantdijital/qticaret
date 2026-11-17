import { ArrowDown, ArrowUp, CircleAlert, Ellipsis, Eye, EyeOff, GripVertical } from "lucide-react"
import { useId } from "react"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import type { FooterDrag } from "./footer-drag"
import { placeOf } from "./footer-drag"

const R = "storefront.editor.row"

export interface PartAction {
  label: string
  icon: LucideIcon
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

interface PartRowProps {
  kind: "row" | "block"
  id: string
  icon: LucideIcon
  name: string
  detail: string | null
  current: boolean
  problem: boolean
  /** A block is shown or hidden by its eye; a row always shows. */
  visible?: boolean
  onToggle?: () => void
  onOpen: () => void
  moves: { up: (() => void) | null; down: (() => void) | null }
  actions: readonly PartAction[]
  drag: FooterDrag
  children?: ReactNode
}

/**
 * A row or a block in the footer's tree (adr/0070 §7), drawn as a page's
 * section is (`section-row.tsx`): dragged by its handle, opened by its
 * name, a block shown or hidden by its eye, moved, copied or removed from
 * its menu; the arrows are the keyboard's and a single pointer's way to
 * move it (WCAG 2.1.1, 2.5.7). What it holds (a row's columns) follows it.
 */
export function PartRow({
  kind,
  id,
  icon: Icon,
  name,
  detail,
  current,
  problem,
  visible = true,
  onToggle,
  onOpen,
  moves,
  actions,
  drag,
  children,
}: PartRowProps) {
  const { t } = useTranslation()
  const detailId = useId()
  const line = drag.over?.kind === kind ? drag.over : null
  const over = line?.id === id ? line.place : null
  return (
    <li data-footer-part={id} className="flex flex-col">
      <div
        className={cn(
          "group/row relative flex items-center gap-0.5 rounded-md py-0.5 pr-1 hover:bg-muted/60 focus-within:bg-muted/60",
          current && "bg-muted",
          drag.dragged?.id === id && "opacity-50"
        )}
        onDragOver={(event) => {
          if (drag.overLine(kind, id, placeOf(event))) {
            event.preventDefault()
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          drag.dropLine(kind, id, placeOf(event))
        }}
      >
        {over ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-1 z-10 h-0.5 bg-primary",
              over === "before" ? "-top-px" : "-bottom-px"
            )}
          />
        ) : null}
        <span
          draggable
          aria-hidden="true"
          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move"
            event.dataTransfer.setData("text/plain", id)
            const line = event.currentTarget.parentElement
            if (line) {
              event.dataTransfer.setDragImage(line, 16, 16)
            }
            drag.start(kind, id)
          }}
          onDragEnd={drag.stop}
        >
          <GripVertical className="size-3.5" />
        </span>
        <button
          type="button"
          aria-describedby={detail ? detailId : undefined}
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
          {detail ? (
            <span id={detailId} className="truncate text-xs text-muted-foreground">
              {detail}
            </span>
          ) : null}
          {problem ? (
            <CircleAlert
              role="img"
              aria-label={t(`${R}.problem`)}
              className="size-3.5 shrink-0 text-destructive-text"
            />
          ) : null}
        </button>
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
        {onToggle ? (
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
        ) : null}
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
            {actions.map((action) => (
              <PartMenuItem key={action.label} action={action} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children}
    </li>
  )
}

function PartMenuItem({ action }: { action: PartAction }) {
  const Icon = action.icon
  return (
    <>
      {action.destructive ? <DropdownMenuSeparator /> : null}
      <DropdownMenuItem
        disabled={action.disabled ?? false}
        variant={action.destructive ? "destructive" : "default"}
        onSelect={action.onSelect}
      >
        <Icon />
        {action.label}
      </DropdownMenuItem>
    </>
  )
}
