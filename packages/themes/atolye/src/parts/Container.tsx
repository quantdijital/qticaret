import type { ComponentProps } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The one container (docs/tema/yon-2026-11-05.md § Grid): 1440 px at
 * most, centred, its gutter 16, 24 or 48 px; at 1920 only the margins grow.
 */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto w-full max-w-(--container) px-(--gutter)", className)} {...props} />
  )
}
