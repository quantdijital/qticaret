"use client"

import type { MouseEvent, ReactNode } from "react"
import { OPEN_SEARCH_EVENT, askFrame, isOwnClick } from "./events"

/** A phone's search field, in the dropping search (`SearchDrop`). */
export const PHONE_SEARCH = "arama-dar"

/**
 * The bottom bar's "Ara": drops a phone's search down from the top
 * (`SearchDrop`, `qt:open-search`; every header, owner 2026-11-16), the
 * cursor in its field, so the keyboard opens at once and the live panel
 * answers as they type (no page to load first). Without script, or with
 * no dropping search to hear it, a plain link to `/arama`.
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
    // Safari gives a pressed link no focus: the dropping search takes it as the one to go back to
    event.currentTarget.focus({ preventScroll: true })
    if (askFrame(OPEN_SEARCH_EVENT)) {
      event.preventDefault()
    }
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
