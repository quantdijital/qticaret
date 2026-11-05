"use client"

import type { MouseEvent } from "react"
import { COOKIE_PREFERENCES_EVENT, askFrame, isOwnClick } from "./events"

/**
 * The footer's "Çerez tercihleri" (D9): opens the notice again where the
 * visitor is; without script, or with no banner on the page, a plain link
 * to `/cerez-tercihleri`, which asks the same.
 */
export function CookiePreferencesLink({ label, className }: { label: string; className?: string }) {
  const reopen = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isOwnClick(event) && askFrame(COOKIE_PREFERENCES_EVENT)) {
      event.preventDefault()
    }
  }
  return (
    <a href="/cerez-tercihleri" onClick={reopen} className={className}>
      {label}
    </a>
  )
}
