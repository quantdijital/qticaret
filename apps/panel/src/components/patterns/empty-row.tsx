import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * A detail page's empty part as one row, not a card (docs/06 "Detay
 * sayfası düzeni"): one sentence and, when there is one, its action
 * ("İade yok" · "İade talebi aç"). A card is drawn only once there is
 * something in it.
 */
export function EmptyRow({
  text,
  action,
  className,
}: {
  text: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-5 py-3 text-sm shadow-card",
        className
      )}
    >
      <p className="text-muted-foreground">{text}</p>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}
