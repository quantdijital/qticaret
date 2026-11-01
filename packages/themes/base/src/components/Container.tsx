import type { ComponentProps } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/** The page's width and side gutters; every band of the frame and page uses it. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />
  )
}
