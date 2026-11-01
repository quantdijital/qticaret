import type { ComponentProps } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/** The page's width and side gutters; every band of the frame and page uses it. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[84rem] px-4 sm:px-6 lg:px-10", className)}
      {...props}
    />
  )
}

/** A page's own band: the width and the space under the header. */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return <Container className={cn("py-6 lg:py-10", className)} {...props} />
}
