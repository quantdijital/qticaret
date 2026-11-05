import type { ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A bought line's photograph (cart, drawer, checkout, order): a link to
 * its product's page when the line has one. The name beside it is the
 * same link, so this one is hidden from the reader and the Tab key, one
 * stop per line. Without a page, the plain box.
 */
export function LinePhoto({
  path,
  className,
  children,
}: {
  path?: string | null | undefined
  className: string
  children: ReactNode
}) {
  if (!path) {
    return <div className={className}>{children}</div>
  }
  return (
    <a href={path} tabIndex={-1} aria-hidden="true" className={cn("block", className)}>
      {children}
    </a>
  )
}

/** A bought line's name: a link to its product's page when it has one, else the words alone. */
export function LineName({ path, title }: { path?: string | null | undefined; title: string }) {
  if (!path) {
    return title
  }
  return (
    <a href={path} className="no-underline underline-offset-4 hover:underline">
      {title}
    </a>
  )
}
