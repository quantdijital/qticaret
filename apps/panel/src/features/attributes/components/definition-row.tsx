import { ArrowDown, ArrowUp, ChevronDown, Ellipsis, GripVertical, Trash2 } from "lucide-react"
import type { DragEvent } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qticaret/admin-ui/ui/dropdown-menu"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { DropPlace } from "@/features/attributes/definition-list"
import type { TemplateForm } from "@/features/attributes/form"
import { DefinitionFields } from "./definition-fields"

const A = "attributes"

/** The list's drag state as one row sees it. */
export interface RowDrag {
  /** A row of this list is being dragged: other drags are left alone. */
  active: boolean
  dragging: boolean
  over: DropPlace | null
  onStart: () => void
  onEnd: () => void
  onOver: (place: DropPlace) => void
  onDrop: (place: DropPlace) => void
}

interface DefinitionRowProps {
  index: number
  count: number
  open: boolean
  onToggle: () => void
  onMove: (to: number) => void
  onRemove: () => void
  drag: RowDrag
}

// The upper half of a row drops before it, the lower half after
const placeOf = (event: DragEvent<HTMLElement>): DropPlace => {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "before" : "after"
}

/** The settings that are on, as quiet badges: what a folded row tells at a glance. */
function useBadges(index: number): string[] {
  const { t } = useTranslation()
  const { control } = useFormContext<TemplateForm>()
  const base = `definitions.${index}` as const
  const [scope, shown, required, filter] = useWatch({
    control,
    name: [`${base}.scope`, `${base}.is_public`, `${base}.is_required`, `${base}.is_filterable`],
  })
  const variant = scope === "variant"
  return [
    required ? t(`${A}.badges.required`) : null,
    filter && (variant || shown) ? t(`${A}.badges.filter`) : null,
    variant ? t(`${A}.badges.variant`) : null,
    variant || shown ? null : t(`${A}.badges.hidden`),
  ].filter((badge): badge is string => badge !== null)
}

/**
 * One attribute of the template: folded, a single line (handle, name,
 * type, what is on); a click opens its fields in place. Dragged by its
 * handle; its menu moves it up or down for a keyboard or a single
 * pointer (WCAG 2.5.7), or removes it.
 */
export function DefinitionRow({
  index,
  count,
  open,
  onToggle,
  onMove,
  onRemove,
  drag,
}: DefinitionRowProps) {
  const { t } = useTranslation()
  const { control } = useFormContext<TemplateForm>()
  const base = `definitions.${index}` as const
  const [label, type] = useWatch({ control, name: [`${base}.label`, `${base}.type`] })
  const badges = useBadges(index)
  const name = label.trim() || t(`${A}.untitled`)
  return (
    <li
      className={cn("relative", drag.dragging && "opacity-50")}
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
      <div className={cn("flex items-center gap-1 py-1 pr-2 pl-1", open && "bg-muted/50")}>
        {/* A pointer's way to move it; the menu is the keyboard's */}
        <span
          draggable
          aria-hidden="true"
          title={t(`${A}.drag`)}
          className="flex h-9 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move"
            // Firefox starts a drag only with data; the row is what follows the pointer
            event.dataTransfer.setData("text/plain", String(index))
            const row = event.currentTarget.closest("li")
            if (row) {
              event.dataTransfer.setDragImage(row, 16, 16)
            }
            drag.onStart()
          }}
          onDragEnd={drag.onEnd}
        >
          <GripVertical className="size-4" />
        </span>
        <button
          type="button"
          aria-expanded={open}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left"
          onClick={onToggle}
        >
          <span className="min-w-0 text-sm font-medium wrap-anywhere">{name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{t(`${A}.types.${type}`)}</span>
          {/* On a phone the name keeps the line; the open row's switches tell the rest */}
          <span className="ml-auto flex shrink-0 gap-1">
            {badges.map((badge) => (
              <Badge
                key={badge}
                variant="outline"
                className="hidden font-normal text-muted-foreground sm:inline-flex"
              >
                {badge}
              </Badge>
            ))}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t(`${A}.actions`, { name })}
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() => {
                onMove(index - 1)
              }}
            >
              <ArrowUp />
              {t(`${A}.moveUp`)}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === count - 1}
              onSelect={() => {
                onMove(index + 1)
              }}
            >
              <ArrowDown />
              {t(`${A}.moveDown`)}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2 />
              {t(`${A}.remove`)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open ? <DefinitionFields index={index} /> : null}
    </li>
  )
}
