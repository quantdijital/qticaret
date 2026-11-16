"use client"

import type { MouseEvent, ReactNode } from "react"
import { isOwnClick } from "./events"

/** The phone header's search field (Header). */
export const PHONE_SEARCH = "arama-dar"

/**
 * The bottom bar's "Ara": puts the cursor in the header's search where
 * the visitor is, so the keyboard opens at once and the live panel
 * answers as they type (no page to load first). Every header has the
 * field on a phone (`PhoneSearch`). Without script, or with the field
 * off the screen, a plain link to `/arama`.
 */
export function SearchLink({
  className,
  current,
  children,
}: {
  className: string
  current: boolean
  children: ReactNode
}) {
  const focus = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isOwnClick(event)) {
      return
    }
    const field = document.getElementById(PHONE_SEARCH)
    if (!(field instanceof HTMLInputElement) || field.offsetParent === null) {
      return
    }
    event.preventDefault()
    field.focus()
    field.select()
  }
  return (
    <a
      href="/arama"
      onClick={focus}
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {children}
    </a>
  )
}
