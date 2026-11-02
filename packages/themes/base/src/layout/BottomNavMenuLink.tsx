"use client"

import type { MouseEvent, ReactNode } from "react"
import { OPEN_MENU_EVENT } from "./menu-events"

/**
 * The bottom bar's "Kategoriler": opens the menu drawer where the visitor
 * is; without script, or before the drawer is ready, a plain link to
 * `/kategoriler`, every category on a page of its own.
 */
export function BottomNavMenuLink({
  className,
  current,
  children,
}: {
  className: string
  current: boolean
  children: ReactNode
}) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab, or a click someone else handled, is the link's own
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    const asked = new Event(OPEN_MENU_EVENT, { cancelable: true })
    if (!window.dispatchEvent(asked)) {
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
