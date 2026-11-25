import { ArrowDown, ArrowUp, GripVertical, Lock } from "lucide-react"
import { useState } from "react"
import type { DragEvent } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { dropIndex } from "@/features/attributes/definition-list"
import type { DropPlace } from "@/features/attributes/definition-list"
import { isLocked } from "./parts"
import type { PartKey } from "./parts"

const L = "products.layout"

// Parts drawn only when the product or the shop uses them
const CONDITIONAL: ReadonlySet<PartKey> = new Set([
  "departures",
  "program",
  "faq",
  "addons",
  "shipping",
])

// The upper half of a row drops before it, the lower half after
const placeOf = (event: DragEvent<HTMLElement>): DropPlace => {
  const box = event.currentTarget.getBoundingClientRect()
  return event.clientY < box.top + box.height / 2 ? "before" : "after"
}

/**
 * One column's parts in "Sayfayı düzenle": dragged by the handle, or moved
 * by the arrows (the keyboard's and a single pointer's way, WCAG 2.5.7);
 * the switch shows or hides a part. A locked part has no switch to turn off.
 */
export function LayoutList<K extends PartKey>({
  title,
  order,
  hidden,
  onOrder,
  onToggle,
}: {
  title: string
  order: readonly K[]
  hidden: ReadonlySet<PartKey>
  onOrder: (order: K[]) => void
  onToggle: (key: K) => void
}) {
  const { t } = useTranslation()
  const [dragged, setDragged] = useState<number | null>(null)
  const [over, setOver] = useState<{ at: number; place: DropPlace } | null>(null)
  const move = (from: number, to: number) => {
    const next = [...order]
    const [item] = next.splice(from, 1)
    if (item !== undefined) {
      next.splice(to, 0, item)
      onOrder(next)
    }
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-1" aria-label={title}>
        {order.map((key, index) => {
          const name = t(`${L}.parts.${key}`)
          const locked = isLocked(key)
          const shown = !hidden.has(key)
          const line = over?.at === index && dragged !== index ? over.place : null
          return (
            <li
              key={key}
              data-part-row={key}
              className={cn(
                "group/row relative flex min-h-11 items-center gap-1 rounded-md border bg-card py-1 pr-2 pl-1",
                dragged === index && "opacity-50"
              )}
              onDragOver={(event) => {
                if (dragged !== null) {
                  event.preventDefault()
                  setOver({ at: index, place: placeOf(event) })
                }
              }}
              onDrop={(event) => {
                if (dragged !== null) {
                  event.preventDefault()
                  move(dragged, dropIndex(dragged, index, placeOf(event)))
                }
                setDragged(null)
                setOver(null)
              }}
            >
              {line ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-1 z-10 h-0.5 bg-primary",
                    line === "before" ? "-top-1" : "-bottom-1"
                  )}
                />
              ) : null}
              <span
                draggable
                aria-hidden="true"
                className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move"
                  // Firefox starts a drag only with data
                  event.dataTransfer.setData("text/plain", key)
                  const row = event.currentTarget.closest("li")
                  if (row) {
                    event.dataTransfer.setDragImage(row, 16, 16)
                  }
                  setDragged(index)
                }}
                onDragEnd={() => {
                  setDragged(null)
                  setOver(null)
                }}
              >
                <GripVertical className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn("truncate text-sm", !shown && "text-muted-foreground line-through")}
                >
                  {name}
                </span>
                {locked || CONDITIONAL.has(key) ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {t(locked ? `${L}.locked` : `${L}.conditional`)}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === 0}
                aria-label={t(`${L}.moveUp`, { name })}
                onClick={() => {
                  move(index, index - 1)
                }}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === order.length - 1}
                aria-label={t(`${L}.moveDown`, { name })}
                onClick={() => {
                  move(index, index + 1)
                }}
              >
                <ArrowDown />
              </Button>
              {locked ? (
                <span className="flex w-8 justify-center text-muted-foreground">
                  <Lock className="size-4" aria-hidden="true" />
                </span>
              ) : (
                <span className="flex w-8 justify-center">
                  <Switch
                    checked={shown}
                    aria-label={t(`${L}.show`, { name })}
                    onCheckedChange={() => {
                      onToggle(key)
                    }}
                  />
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
