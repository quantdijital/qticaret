import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger"

const TONES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground before:bg-muted-foreground",
  info: "bg-info-soft text-info-text before:bg-info",
  success: "bg-success-soft text-success-text before:bg-success",
  warning: "bg-warning-soft text-warning-text before:bg-warning",
  danger: "bg-destructive-soft text-destructive-text before:bg-destructive",
}

/** A state in words with a dot (docs/18 §7): the colour supports the label, never replaces it. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        "before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
        TONES[tone]
      )}
    >
      {children}
    </span>
  )
}
