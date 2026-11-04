import type { ComponentProps } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The one container (design.md § Spacing): 1440 px at most, centred, its
 * gutter 16, 24 or 64 px; at 1920 only the margins grow.
 */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto w-full max-w-(--container) px-(--gutter)", className)} {...props} />
  )
}
