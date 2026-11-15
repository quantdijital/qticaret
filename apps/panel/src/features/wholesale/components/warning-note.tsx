import { TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@qticaret/admin-ui/lib/utils"

/** A warning, never a block (ADR-0068 Ek 2026-11-15): the icon on the first line (docs/18 §2). */
export function WarningNote({
  children,
  action,
  className,
}: {
  children: ReactNode
  /** A shortcut beside the words (a filter, a page). */
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] leading-5 text-warning-text",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <TriangleAlert className="h-lh w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {action}
    </div>
  )
}
