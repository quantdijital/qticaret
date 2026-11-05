"use client"

import type { MouseEvent, ReactNode } from "react"
import { OPEN_MENU_EVENT, askFrame, isOwnClick } from "./events"

/**
 * The bottom bar's "Kategoriler": opens the menu sheet where the visitor
 * is; without script, a plain link to `/kategoriler`.
 */
export function MenuLink({
  className,
  current,
  children,
}: {
  className: string
  current: boolean
  children: ReactNode
}) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isOwnClick(event) && askFrame(OPEN_MENU_EVENT)) {
      event.preventDefault()
    }
  }
  return (
    <a
      href="/kategoriler"
      onClick={open}
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {children}
    </a>
  )
}
